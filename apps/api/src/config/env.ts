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
  emailFromName: process.env.EMAIL_FROM_NAME || "Broady",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || "msaad23305@gmail.com",
  emailProvider: process.env.EMAIL_PROVIDER || "ses",
  awsRegion: process.env.AWS_REGION || process.env.SES_REGION || "ap-south-1",
  sesRegion: process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1",
  sesSmtpHost:
    process.env.SES_SMTP_HOST ||
    process.env.SMTP_HOST ||
    `email-smtp.${process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1"}.amazonaws.com`,
  sesSmtpPort: Number(process.env.SES_SMTP_PORT || process.env.SMTP_PORT || 587),
  sesSmtpSecure:
    process.env.SES_SMTP_SECURE !== undefined
      ? process.env.SES_SMTP_SECURE !== "false"
      : process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE !== "false"
        : false,
  sesSmtpUser: process.env.SES_SMTP_USER || process.env.SMTP_USER || "",
  sesSmtpPass: process.env.SES_SMTP_PASS || process.env.SMTP_PASS || "",
  smtpHost:
    process.env.SMTP_HOST ||
    process.env.SES_SMTP_HOST ||
    `email-smtp.${process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1"}.amazonaws.com`,
  smtpPort: Number(process.env.SMTP_PORT || process.env.SES_SMTP_PORT || 587),
  smtpSecure:
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE !== "false"
      : process.env.SES_SMTP_SECURE !== undefined
        ? process.env.SES_SMTP_SECURE !== "false"
        : false,
  smtpUser: process.env.SMTP_USER || process.env.SES_SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || process.env.SES_SMTP_PASS || "",
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
