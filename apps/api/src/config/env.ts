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
  nodeEnv: process.env.NODE_ENV || "development",
};

if (!env.databaseUrl) {
  console.warn("DATABASE_URL is not configured. API calls requiring DB will fail.");
}
