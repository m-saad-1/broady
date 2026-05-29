import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { shutdownRedisClient } from "./config/redis.js";
import type { AddressInfo } from "node:net";

const MAX_PORT_RETRIES = 10;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runPrismaMigrations() {
  return new Promise<void>((resolve, reject) => {
    const prismaCli = path.resolve(packageRoot, "..", "..", "node_modules", "prisma", "build", "index.js");
    const child = spawn(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: packageRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(signal ? `Prisma migration deploy terminated by ${signal}` : `Prisma migration deploy failed with exit code ${code ?? "unknown"}`));
    });
  });
}

let server: ReturnType<typeof app.listen> | null = null;
let dbKeepAliveTimer: ReturnType<typeof setInterval> | null = null;
let dbFailureCount = 0;

function bootServer(port: number, attempt = 0) {
  const server = app.listen(port);

  server.on("listening", () => {
    const address = server.address() as AddressInfo | null;
    const boundPort = address?.port ?? port;

    console.log(`BROADY API running on http://localhost:${boundPort}`);

    // Start a periodic keep-alive ping to keep DB connections active with fast reconnect
    try {
      const keepAliveMs = Number(process.env.DB_KEEPALIVE_MS) || 60000; // default 60s
      const fastRetryMs = Number(process.env.DB_RECONNECT_RETRY_MS) || 5000; // fast retry 5s when disconnected

      if (dbKeepAliveTimer) clearInterval(dbKeepAliveTimer);
      dbFailureCount = 0;

      let currentIntervalMs = keepAliveMs;

      const scheduleKeepAlive = () => {
        if (dbKeepAliveTimer) clearInterval(dbKeepAliveTimer);
        dbKeepAliveTimer = setInterval(async () => {
          try {
            // lightweight ping
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await prisma.$queryRaw`SELECT 1`;
            if (dbFailureCount > 0) {
              console.log(`[db] keepalive reconnected after ${dbFailureCount} failed attempts`);
              dbFailureCount = 0;
              if (currentIntervalMs !== keepAliveMs) {
                currentIntervalMs = keepAliveMs;
                console.log(`[db] reverting to normal keepalive interval (${keepAliveMs}ms)`);
                scheduleKeepAlive();
              }
            }
          } catch (err) {
            dbFailureCount++;
            if (dbFailureCount === 1) {
              console.warn(`[db] keepalive ping failed, switching to fast retry (${fastRetryMs}ms)`, err);
              currentIntervalMs = fastRetryMs;
              scheduleKeepAlive();
            } else if (dbFailureCount % 5 === 0) {
              console.warn(`[db] keepalive still failing (${dbFailureCount} attempts)`, err);
            }
          }
        }, currentIntervalMs);
      };

      scheduleKeepAlive();
      console.log(`[db] keepalive ping scheduled every ${keepAliveMs}ms (fast retry ${fastRetryMs}ms on disconnect)`);
    } catch (e) {
      console.warn("[db] failed to schedule keepalive ping", e);
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && attempt < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      console.warn(`[server] port ${port} is in use, retrying on ${nextPort}`);
      server.close();
      void bootServer(nextPort, attempt + 1);
      return;
    }

    console.error("[server] failed to start", {
      port,
      code: error.code,
      message: error.message,
    });
    process.exit(1);
  });

  return server;
}

async function main() {
  const shouldRunMigrations = process.env.PRISMA_MIGRATE_ON_BOOT !== "false";

  if (shouldRunMigrations) {
    await runPrismaMigrations();
  } else {
    console.warn("[server] skipping prisma migrate deploy because PRISMA_MIGRATE_ON_BOOT=false");
  }

  await prisma.$connect();

  server = bootServer(env.port);
}

// Global error handlers to prevent process crash
process.on("uncaughtException", (err) => {
  console.error("[process] uncaught exception - process will continue running", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  // Do NOT exit - let the application keep running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[process] unhandled rejection - process will continue running", {
    reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : reason,
    promise: promise.toString(),
  });
  // Do NOT exit - let the application keep running
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] received ${signal}, shutting down`);

  if (!server) {
    dbFailureCount = 0;
    await prisma.$disconnect().catch(() => undefined);
    await shutdownRedisClient().catch(() => undefined);
    process.exit(0);
    return;
  }

  server.close(async () => {
    if (dbKeepAliveTimer) {
      clearInterval(dbKeepAliveTimer);
      dbKeepAliveTimer = null;
    }
    dbFailureCount = 0;

    await prisma.$disconnect().catch(() => undefined);
    await shutdownRedisClient().catch(() => undefined);
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[server] bootstrap failed", { message });
  process.exit(1);
});
