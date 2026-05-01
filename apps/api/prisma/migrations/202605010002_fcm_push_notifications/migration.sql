-- Add Firebase push notification delivery support.
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'PUSH';

CREATE TABLE IF NOT EXISTS "UserDeviceToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'WEB',
  "userAgent" TEXT,
  "disabledAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserDeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDeviceToken_token_key" ON "UserDeviceToken"("token");
CREATE INDEX IF NOT EXISTS "UserDeviceToken_userId_disabledAt_idx" ON "UserDeviceToken"("userId", "disabledAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserDeviceToken_userId_fkey'
  ) THEN
    ALTER TABLE "UserDeviceToken"
    ADD CONSTRAINT "UserDeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
