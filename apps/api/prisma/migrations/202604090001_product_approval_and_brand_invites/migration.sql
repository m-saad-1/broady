-- Brand invite onboarding and product moderation workflow.
DO $$ BEGIN
  CREATE TYPE "ProductApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "brandInviteTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "brandInviteTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "brandInviteAcceptedAt" TIMESTAMP(3);

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "approvalStatus" "ProductApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "approvalReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalReviewedById" TEXT;

ALTER TABLE "Product"
  ALTER COLUMN "approvalStatus" SET DEFAULT 'APPROVED';

UPDATE "Product" SET "approvalStatus" = 'APPROVED' WHERE "approvalStatus" IS NULL;
