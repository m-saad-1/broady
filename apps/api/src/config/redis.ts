// @ts-ignore - ioredis types are complex
import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import { env } from "./env.js";

let redisClient: any | null = null;
let lastRedisErrorAt = 0;

export function parseRedisConnectionOptions(redisUrl: string): RedisOptions {
  const parsed = new URL(redisUrl);
  const dbSegment = parsed.pathname.replace("/", "").trim();
  const db = dbSegment ? Number(dbSegment) : 0;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    lazyConnect: true,
    enableOfflineQueue: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 0,
    connectTimeout: 500,
    retryStrategy: () => null,
  };
}

export function getRedisClient(): any {
  if (!redisClient) {
    try {
      // @ts-ignore - ioredis constructor types
      redisClient = new Redis(env.redisUrl, parseRedisConnectionOptions(env.redisUrl));

      // Suppress connection errors to prevent process crash
      redisClient.on("error", (error: any) => {
        // Silently handle Redis errors - rate limiting will gracefully degrade
      });

      redisClient.on("end", () => {
        // Silently handle connection end
      });

      redisClient.on("close", () => {
        // Silently handle close event
      });

      redisClient.on("reconnecting", () => {
        // Silently handle reconnecting event
      });
    } catch (error) {
      console.debug("[redis] failed to initialize client (will operate without rate limiting)", {
        message: error instanceof Error ? error.message : String(error),
      });
      // Return null to indicate no Redis available - rate limiting middleware will handle gracefully
      redisClient = null;
    }
  }

  return redisClient;
}

export async function shutdownRedisClient(): Promise<void> {
  if (!redisClient) return;

  const client = redisClient;
  redisClient = null;

  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

export async function getRedisHealthMetrics() {
  const client = getRedisClient();
  const startedAt = Date.now();

  try {
    const [pong, memoryInfo] = await Promise.all([client.ping(), client.info("memory")]);
    const latencyMs = Date.now() - startedAt;
    const memoryLine = memoryInfo
      .split("\n")
      .find((line: string) => line.startsWith("used_memory_human:") || line.startsWith("used_memory:"));

    return {
      ok: pong === "PONG",
      status: client.status,
      latencyMs,
      memory: memoryLine ? memoryLine.split(":")[1]?.trim() : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: client.status,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
