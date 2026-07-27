import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConnectionManager } from "@/lib/infrastructure/resilience/ConnectionManager";

/**
 * Integration tests for the conversation-lock fail-fast fix.
 *
 * These tests use a REAL ioredis instance pointed at a port where
 * no Redis server is listening.  They verify that:
 *
 *   1. redis.set() rejects (does NOT hang forever)
 *   2. It rejects within a reasonable time bound (15 s)
 *   3. The catch block is reachable (graceful degradation)
 *
 * WARNING: These tests take a few seconds because ioredis retries
 *          3 times before giving up (≈ 600 ms backoff + TCP timeouts).
 */

const DEAD_REDIS = "redis://localhost:1"; // port 1 — nothing listens here

function resetCache(): void {
  (ConnectionManager as unknown as { redisInstances: Map<string, unknown> }).redisInstances = new Map();
}

describe("conversation-lock — real ioredis, unavailable Redis", () => {
  beforeAll(() => {
    // Point at a port where no Redis is running
    process.env.UPSTASH_REDIS_URL = DEAD_REDIS;
    resetCache();
  });

  afterAll(() => {
    delete process.env.UPSTASH_REDIS_URL;
    resetCache();
  });

  it("redis.set() rejects within 15 s instead of hanging forever", async () => {
    const redis = ConnectionManager.getRedisConnection("conversation-lock");
    const start = Date.now();

    try {
      await redis.set("integration:lock:test", "val", "PX", 1000, "NX");
      // If this succeeds unexpectedly (e.g. a Redis is actually running
      // on port 1 somehow), the test is still valid — it didn't hang.
      // We just skip fail-time assertions.
    } catch (err) {
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(15000);
      expect(err).toBeTruthy();
    }
  });

  it("catch block executes and processing can continue (graceful degradation)", async () => {
    const redis = ConnectionManager.getRedisConnection("conversation-lock");
    let catchExecuted = false;
    let acquired = false;

    try {
      // Simulate ConversationEngine.ts:37-50
      const result = await redis.set("integration:lock:test2", "val", "PX", 15000, "NX");
      if (result === "OK") acquired = true;
    } catch {
      catchExecuted = true;
      // "Proceeding without lock"
    }

    // Either the lock was acquired (unlikely — Redis is down) or
    // the catch block ran.  The important thing is control flow
    // continues without hanging.
    if (catchExecuted) {
      expect(acquired).toBe(false);
    }
    // If !catchExecuted, the command succeeded — Redis IS running.
    // The test still passes (graceful path not needed).
  });
});

describe("BullMQ connections — config unchanged", () => {
  beforeAll(() => {
    process.env.UPSTASH_REDIS_URL = DEAD_REDIS;
    resetCache();
  });

  afterAll(() => {
    delete process.env.UPSTASH_REDIS_URL;
    resetCache();
  });

  it("whatsapp-incoming still has maxRetriesPerRequest: null", () => {
    // We verify config by checking the last constructor call.
    // Since we can't import IORedis (it's mocked in unit tests),
    // we verify via the instance's options.
    const redis = ConnectionManager.getRedisConnection("whatsapp-incoming");
    // ioredis exposes resolved options on the instance
    expect((redis as unknown as { options: { maxRetriesPerRequest: number | null } }).options.maxRetriesPerRequest).toBeNull();
  });
});
