import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../config/redis.js";

type RateLimitOptions = {
  namespace: string;
  windowMs: number;
  limit: number;
  keyResolver: (req: Request) => string | null;
};

function requestIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || req.ip;
  }

  return req.ip;
}

export function createRedisRateLimiter(options: RateLimitOptions) {
  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const keySuffix = options.keyResolver(req);
    if (!keySuffix) {
      next();
      return;
    }

    const client = getRedisClient();
    const redisKey = `rate:${options.namespace}:${keySuffix}`;
    const now = Date.now();

    try {
      const result = (await client.eval(
        `
          local key = KEYS[1]
          local now = tonumber(ARGV[1])
          local windowMs = tonumber(ARGV[2])
          local limit = tonumber(ARGV[3])
          local requestId = ARGV[4]

          redis.call("ZREMRANGEBYSCORE", key, 0, now - windowMs)
          redis.call("ZADD", key, now, requestId)
          redis.call("PEXPIRE", key, windowMs + 1000)

          local count = redis.call("ZCARD", key)
          local earliest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")

          if count > limit then
            local earliestScore = earliest[2]
            local retryAfterMs = windowMs

            if earliestScore then
              retryAfterMs = math.max(windowMs - (now - tonumber(earliestScore)), 1000)
            end

            return { 0, count, retryAfterMs }
          end

          return { 1, count, 0 }
        `,
        1,
        redisKey,
        now.toString(),
        options.windowMs.toString(),
        options.limit.toString(),
        randomUUID(),
      )) as [number, number, number];

      const allowed = Number(result[0]) === 1;
      const count = Number(result[1]);
      const retryAfterMs = Number(result[2]);

      if (!allowed) {
        res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
        return res.status(429).json({
          message: "Too many requests",
          retryAfterMs,
          limit: options.limit,
          windowMs: options.windowMs,
          scope: keySuffix,
          count,
        });
      }

      next();
    } catch (error) {
      console.warn("[rate-limit] redis unavailable, allowing request", {
        namespace: options.namespace,
        scope: keySuffix,
        ip: requestIp(req),
        message: error instanceof Error ? error.message : String(error),
      });
      next();
    }
  };
}

export function createIpRateLimiter(namespace: string, windowMs: number, limit: number) {
  return createRedisRateLimiter({
    namespace,
    windowMs,
    limit,
    keyResolver: (req) => `ip:${requestIp(req)}`,
  });
}

export function createUserRateLimiter(namespace: string, windowMs: number, limit: number) {
  return createRedisRateLimiter({
    namespace,
    windowMs,
    limit,
    keyResolver: (req) => {
      const auth = (req as Request & { auth?: { userId?: string } }).auth;
      if (!auth?.userId) return null;
      return `user:${auth.userId}`;
    },
  });
}

export function createUserAndIpRateLimiters(namespace: string, windowMs: number, userLimit: number, ipLimit: number) {
  return [createIpRateLimiter(`${namespace}:ip`, windowMs, ipLimit), createUserRateLimiter(`${namespace}:user`, windowMs, userLimit)];
}
