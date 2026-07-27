import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock ioredis ───────────────────────────────────────────────────────────
// Must use a regular function (not an arrow) so `new IORedis()` works.

interface CapturedOpts {
  maxRetriesPerRequest: number | null;
  enableOfflineQueue: boolean;
  connectTimeout: number | undefined;
  retryStrategy: ((times: number) => number | null) | undefined;
}

let lastOpts: CapturedOpts | null = null;

// Shared mock fns — declared at module level so tests can reconfigure them
const mockSet = vi.fn<any>().mockResolvedValue("OK");
const mockOn = vi.fn();
const mockInfo = vi.fn().mockResolvedValue("");

vi.mock("ioredis", () => ({
  default: function MockIORedis(this: Record<string, unknown>, _url: string, opts: CapturedOpts) {
    lastOpts = opts;
    this.set = mockSet;
    this.on = mockOn;
    this.info = mockInfo;
  },
}));

import { ConnectionManager } from "@/lib/infrastructure/resilience/ConnectionManager";

// ── Helpers ────────────────────────────────────────────────────────────────

function resetCache(): void {
  (ConnectionManager as unknown as { redisInstances: Map<string, unknown> }).redisInstances = new Map();
  lastOpts = null;
  vi.clearAllMocks();
  // Reset shared mock fns to default behaviour between tests
  mockSet.mockResolvedValue("OK");
}

// ── Unit: config correctness per connection name ───────────────────────────

describe("ConnectionManager config — conversation-lock", () => {
  beforeEach(resetCache);

  it("enableOfflineQueue is false (reject commands when offline)", () => {
    ConnectionManager.getRedisConnection("conversation-lock");
    expect(lastOpts!.enableOfflineQueue).toBe(false);
  });

  it("maxRetriesPerRequest is 3 (finite — command eventually throws)", () => {
    ConnectionManager.getRedisConnection("conversation-lock");
    expect(lastOpts!.maxRetriesPerRequest).toBe(3);
  });

  it("connectTimeout is 5000 (fail initial TCP connect after 5 s)", () => {
    ConnectionManager.getRedisConnection("conversation-lock");
    expect(lastOpts!.connectTimeout).toBe(5000);
  });

  it("retryStrategy returns null after 5 attempts (stops reconnecting)", () => {
    ConnectionManager.getRedisConnection("conversation-lock");
    const strat = lastOpts!.retryStrategy!;
    expect(strat(1)).toBe(100);
    expect(strat(5)).toBe(500);
    expect(strat(6)).toBeNull();
  });
});

describe("ConnectionManager config — BullMQ connections", () => {
  beforeEach(resetCache);

  it("whatsapp-incoming: maxRetriesPerRequest is null (retry forever, BullMQ requirement)", () => {
    ConnectionManager.getRedisConnection("whatsapp-incoming");
    expect(lastOpts!.maxRetriesPerRequest).toBeNull();
  });

  it("document-processing: maxRetriesPerRequest is null", () => {
    ConnectionManager.getRedisConnection("document-processing");
    expect(lastOpts!.maxRetriesPerRequest).toBeNull();
  });

  it("health-check: maxRetriesPerRequest is null (uses same factory)", () => {
    ConnectionManager.getRedisConnection("health-check");
    expect(lastOpts!.maxRetriesPerRequest).toBeNull();
  });

  it("retryStrategy never returns null (reconnects forever, capped at 3 s)", () => {
    ConnectionManager.getRedisConnection("whatsapp-incoming");
    const strat = lastOpts!.retryStrategy!;
    expect(strat(1)).toBe(100);
    expect(strat(30)).toBe(3000);
    expect(strat(999)).toBe(3000);
  });

  it("whatsapp-incoming in production: enableOfflineQueue is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    ConnectionManager.getRedisConnection("whatsapp-incoming");
    expect(lastOpts!.enableOfflineQueue).toBe(true);
    vi.unstubAllEnvs();
  });

  it("whatsapp-incoming in dev: enableOfflineQueue is false (fail-fast for local dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    ConnectionManager.getRedisConnection("whatsapp-incoming");
    expect(lastOpts!.enableOfflineQueue).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("ConnectionManager config — unknown connection name", () => {
  beforeEach(resetCache);

  it("falls back to BullMQ-compatible defaults", () => {
    ConnectionManager.getRedisConnection("some-random-name");
    expect(lastOpts!.maxRetriesPerRequest).toBeNull();
  });
});

// ── Unit: fail-fast behaviour via mock ─────────────────────────────────────

describe("conversation-lock graceful degradation", () => {
  beforeEach(resetCache);

  it("catch block executes when redis.set() rejects", async () => {
    // Arrange — simulate ECONNREFUSED
    mockSet.mockRejectedValue(new Error("Connection is closed."));

    const redis = ConnectionManager.getRedisConnection("conversation-lock");
    let acquired = false;
    let catchExecuted = false;

    // Act — this is the exact pattern from ConversationEngine.ts:36-49
    try {
      const result = await redis.set("lock:conversation:c:p", "val", "PX", 15000, "NX");
      if (result === "OK") acquired = true;
    } catch {
      catchExecuted = true;
      // "Proceeding without lock" — graceful degradation
    }

    expect(catchExecuted).toBe(true);
    expect(acquired).toBe(false);
  });
});
