import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  databaseDirectUrl: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "development-secret",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "",
  webAppUrl: process.env.WEB_APP_URL || "http://localhost:3000",
  cloudinaryUrl: process.env.CLOUDINARY_URL || "",
  awsS3Bucket: process.env.AWS_S3_BUCKET || "",
  cloudflareCdnUrl: process.env.CLOUDFLARE_CDN_URL || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || "notifications@broady.pk",
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  notificationRedisQueueName: process.env.NOTIFICATION_REDIS_QUEUE_NAME || "broady-notifications",
  notificationRedisPrefix: process.env.NOTIFICATION_REDIS_PREFIX || "broady",
  notificationQueueAdapter:
    process.env.NOTIFICATION_QUEUE_ADAPTER === "memory"
      ? "memory"
      : process.env.NOTIFICATION_QUEUE_ADAPTER === "postgres"
        ? "postgres"
        : "redis",
  notificationWorkerPollMs: Number(process.env.NOTIFICATION_WORKER_POLL_MS || 250),
  notificationWorkerConcurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 4),
  notificationWorkerLockTimeoutMs: Number(process.env.NOTIFICATION_WORKER_LOCK_TIMEOUT_MS || 30000),
  notificationWorkerMaxAttempts: Number(process.env.NOTIFICATION_WORKER_MAX_ATTEMPTS || 3),
  notificationWorkerShutdownWaitMs: Number(process.env.NOTIFICATION_WORKER_SHUTDOWN_WAIT_MS || 5000),
  notificationWorkerEmbedded: process.env.NOTIFICATION_WORKER_EMBEDDED === "false" ? false : true,
  notificationWorkerHealthPort: Number(process.env.NOTIFICATION_WORKER_HEALTH_PORT || 0),
  nodeEnv: process.env.NODE_ENV || "development",
};

if (!env.databaseUrl) {
  console.warn("DATABASE_URL is not configured. API calls requiring DB will fail.");
}
