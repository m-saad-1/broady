-- Add delivery failure lifecycle fields to SubOrder for deterministic automation.
ALTER TABLE "SubOrder"
  ADD COLUMN IF NOT EXISTS "failureReasonMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryFailedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "brandReminderSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
