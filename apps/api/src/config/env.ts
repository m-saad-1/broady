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
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: process.env.SMTP_SECURE === "false" ? false : true,
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "broady-1",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || "",
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  /**
   * Meilisearch HTTP API base (no trailing path). For Meilisearch Cloud, use the HTTPS "Database URL" /
   * project host from Project → Settings (e.g. `https://ms-xxxxx.pdx.meilisearch.io`), not `cloud.meilisearch.com`
   * and not localhost unless you run a local binary with matching keys.
   * @see https://www.meilisearch.com/docs/reference/features/authentication
   */
  meilisearchUrl:
    (process.env.MEILISEARCH_URL || process.env.MEILISEARCH_DATABASE_URL || "").trim() || "http://127.0.0.1:7700",
  /** Process env for the Meilisearch binary (`meilisearch.exe` / Docker); not sent as Bearer by default. */
  meiliMasterKey: process.env.MEILI_MASTER_KEY || "",
  /** Default admin API key from Meilisearch (indexes, settings, documents). */
  meilisearchAdminApiKey: process.env.MEILISEARCH_ADMIN_API_KEY || "",
  /** Search-only API key (safe for read/search from app code that must not mutate indexes). */
  meilisearchSearchApiKey: process.env.MEILISEARCH_SEARCH_API_KEY || "",
  /** Chat feature API key when using Meilisearch chat workspaces. */
  meilisearchChatApiKey: process.env.MEILISEARCH_CHAT_API_KEY || "",
  /** Legacy single key; treated like admin if `MEILISEARCH_ADMIN_API_KEY` is unset. */
  meilisearchApiKey: process.env.MEILISEARCH_API_KEY || "",
  notificationRedisQueueName: process.env.NOTIFICATION_REDIS_QUEUE_NAME || "broady-notifications",
  notificationRedisPrefix: process.env.NOTIFICATION_REDIS_PREFIX || "broady",
  notificationQueueAdapter: (() => {
    const configuredAdapter = process.env.NOTIFICATION_QUEUE_ADAPTER;

    if (configuredAdapter === "memory" || configuredAdapter === "postgres" || configuredAdapter === "redis") {
      return configuredAdapter;
    }

    return process.env.REDIS_URL ? "redis" : "postgres";
  })(),
  notificationWorkerPollMs: Number(process.env.NOTIFICATION_WORKER_POLL_MS || 250),
  orderAutomationPollMs: Number(process.env.ORDER_AUTOMATION_POLL_MS || 60_000),
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
