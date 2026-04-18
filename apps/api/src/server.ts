import app from "./app.js";
import { env } from "./config/env.js";
import { stopNotificationWorker, startNotificationWorker } from "./modules/notifications/notification.worker.js";

const server = app.listen(env.port, () => {
  if (env.notificationWorkerEmbedded) {
    startNotificationWorker();
  }

  console.log(`BROADY API running on http://localhost:${env.port}`);
  console.log("[notifications] embedded worker", {
    enabled: env.notificationWorkerEmbedded,
    adapter: env.notificationQueueAdapter,
  });
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] received ${signal}, shutting down`);

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
