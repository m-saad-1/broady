import { createServer, type Server } from "node:http";
import { env } from "./config/env.js";
import { getNotificationWorkerStats } from "./modules/notifications/notification.worker.js";
import { startNotificationWorker, stopNotificationWorker } from "./modules/notifications/notification.worker.js";

let shuttingDown = false;
let healthServer: Server | null = null;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("[notifications] standalone worker shutting down", { signal });

  if (healthServer) {
    await new Promise<void>((resolve) => {
      healthServer!.close(() => resolve());
    });
    healthServer = null;
  }

  await stopNotificationWorker();
  process.exit(0);
}

startNotificationWorker();

console.log("[notifications] standalone worker started", {
  adapter: env.notificationQueueAdapter,
  concurrency: env.notificationWorkerConcurrency,
  maxAttempts: env.notificationWorkerMaxAttempts,
});

if (env.notificationWorkerHealthPort > 0) {
  healthServer = createServer((req, res) => {
    if (req.url !== "/healthz") {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    void (async () => {
      try {
        const stats = await getNotificationWorkerStats();
        const body = JSON.stringify({
          ok: true,
          stats,
        });

        res.setHeader("content-type", "application/json");
        res.statusCode = 200;
        res.end(body);
      } catch (error) {
        res.setHeader("content-type", "application/json");
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    })();
  });

  healthServer.listen(env.notificationWorkerHealthPort, () => {
    console.log("[notifications] standalone worker health endpoint enabled", {
      port: env.notificationWorkerHealthPort,
      path: "/healthz",
    });
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  console.error("[notifications] unhandled rejection in standalone worker", { reason });
});

process.on("uncaughtException", (error) => {
  console.error("[notifications] uncaught exception in standalone worker", {
    error: error.message,
  });
  void shutdown("UNCAUGHT_EXCEPTION");
});
