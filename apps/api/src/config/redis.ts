import Redis, { type RedisOptions } from "ioredis";
import { env } from "./env.js";

let redisClient: Redis | null = null;
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
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: (attempt) => Math.min(attempt * 75, 1000),
  };
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, parseRedisConnectionOptions(env.redisUrl));

    redisClient.on("error", (error) => {
      const now = Date.now();
      if (now - lastRedisErrorAt < 10000) return;
      lastRedisErrorAt = now;
      console.warn("[redis] client error", { message: error.message });
    });

    redisClient.on("end", () => {
      console.warn("[redis] connection ended");
    });
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
      .find((line) => line.startsWith("used_memory_human:") || line.startsWith("used_memory:"));

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
