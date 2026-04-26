import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";
import { env } from "./config/env.js";
import { stopNotificationWorker, startNotificationWorker } from "./modules/notifications/notification.worker.js";
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

let workerStarted = false;
let server: ReturnType<typeof app.listen> | null = null;

function bootServer(port: number, attempt = 0) {
  const server = app.listen(port);

  server.on("listening", () => {
    const address = server.address() as AddressInfo | null;
    const boundPort = address?.port ?? port;

    if (!workerStarted && env.notificationWorkerEmbedded) {
      startNotificationWorker();
      workerStarted = true;
    }

    console.log(`BROADY API running on http://localhost:${boundPort}`);
    console.log("[notifications] embedded worker", {
      enabled: env.notificationWorkerEmbedded,
      adapter: env.notificationQueueAdapter,
    });
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && attempt < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      console.warn(`[server] port ${port} is in use, retrying on ${nextPort}`);
      void stopNotificationWorker().catch(() => undefined);
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

  server = bootServer(env.port);
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] received ${signal}, shutting down`);

  if (!server) {
    await stopNotificationWorker();
    process.exit(0);
    return;
  }

  server.close(async () => {
    await stopNotificationWorker();
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
