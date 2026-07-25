import IORedis from "ioredis";
import { GoogleGenAI } from "@google/genai";

export class ConnectionManager {
  private static redisInstances: Map<string, IORedis> = new Map();

  /**
   * Retrieves or creates a resilient Redis connection.
   * Enforces environment-specific offline queue policies.
   */
  static getRedisConnection(name: string): IORedis {
    if (this.redisInstances.has(name)) {
      return this.redisInstances.get(name)!;
    }

    const redisUrl = process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";
    const isProd = process.env.NODE_ENV === "production";

    // In production, we WANT offline queues so jobs aren't dropped during transient disconnects.
    // In dev, we want to fail fast to prevent hanging the Next.js process if Redis is off.
    const enableOfflineQueue = isProd;

    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableOfflineQueue,
      retryStrategy(times) {
        // Exponential backoff with a cap of 3 seconds
        return Math.min(times * 100, 3000);
      }
    });

    // Handle errors to prevent UnhandledPromiseRejections crashing the Node process
    connection.on("error", (err) => {
      // We log minimally to avoid flooding the console
      if (process.env.DEBUG_REDIS === "true") {
        console.error(`[ConnectionManager] Redis Error (${name}):`, err.message);
      }
    });

    this.redisInstances.set(name, connection);
    return connection;
  }

  /**
   * Safe execution wrapper with a strict timeout to prevent thread pool exhaustion.
   */
  static async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
  }

  private static googleGenAI: GoogleGenAI | null = null;

  /**
   * Retrieves a resilient GoogleGenAI instance.
   */
  static getGoogleGenAI(): GoogleGenAI {
    if (!this.googleGenAI) {
      const apiKey = process.env.GEMINI_API_KEY || "dummy-key-for-dev";
      this.googleGenAI = new GoogleGenAI({ apiKey });
    }
    return this.googleGenAI;
  }

  /**
   * Wraps an external fetch call (like WhatsApp API or OpenAI) with timeouts and retries.
   */
  static async withFetchResilience(
    url: string, 
    options: RequestInit, 
    serviceName: string, 
    timeoutMs: number = 5000,
    retries: number = 2
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.withTimeout(fetch(url, options), timeoutMs, `${serviceName} connection timeout`);
        if (!response.ok && response.status >= 500) {
          throw new Error(`Server error from ${serviceName}: ${response.statusText}`);
        }
        return response;
      } catch (err: any) {
        if (attempt === retries) throw err;
        // Simple backoff: 500ms, 1000ms
        await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
      }
    }
    throw new Error(`Failed to reach ${serviceName} after ${retries} retries`);
  }

  /**
   * Aggregated health check for all infrastructure dependencies.
   * Enforces a strict fail-fast policy (e.g., 2000ms max per check).
   */
  static async checkHealth(prismaClient: any): Promise<{ status: string; details: any }> {
    const details: any = {};
    let isHealthy = true;

    // 1. Check DB
    try {
      await this.withTimeout(prismaClient.$queryRaw`SELECT 1`, 2000, "Database connection timeout");
      details.database = "ok";
    } catch (err: any) {
      details.database = `error: ${err.message}`;
      isHealthy = false;
    }

    // 2. Check Redis
    try {
      const redis = this.getRedisConnection("health-check");
      await this.withTimeout(redis.info(), 2000, "Redis connection timeout");
      details.redis = "ok";
    } catch (err: any) {
      details.redis = `error: ${err.message}`;
      isHealthy = false;
    }

    // 3. Check AI Service (Just ensure initialization didn't crash)
    try {
      this.getGoogleGenAI();
      // Optional: a lightweight ping if supported, otherwise just initialization
      details.ai = "ok";
    } catch (err: any) {
      details.ai = `error: ${err.message}`;
      // Non-critical, does not mark overall health as bad (Graceful Degradation)
    }

    return {
      status: isHealthy ? "ok" : "error",
      details
    };
  }
}
