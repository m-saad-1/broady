-- Recommendation system upgrade.
-- Adds anonymous-session telemetry, recommendation impressions/clicks, and richer event types.

ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'PRODUCT_CLICK';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'RECOMMENDATION_CLICK';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'EXPLICIT_PRODUCT_INTEREST';

ALTER TABLE "UserActivity"
  ADD COLUMN IF NOT EXISTS "anonymousSessionId" TEXT;

ALTER TABLE "UserActivity"
  ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "UserActivity_anonymousSessionId_createdAt_idx"
  ON "UserActivity"("anonymousSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "UserActivity_anonymousSessionId_eventType_createdAt_idx"
  ON "UserActivity"("anonymousSessionId", "eventType", "createdAt");

CREATE TABLE IF NOT EXISTS "RecommendationImpression" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "anonymousSessionId" TEXT,
  "surface" TEXT NOT NULL DEFAULT 'FOR_YOU',
  "algorithm" TEXT NOT NULL DEFAULT 'hybrid_v2',
  "productIds" TEXT[] NOT NULL,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationImpression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecommendationClick" (
  "id" TEXT NOT NULL,
  "impressionId" TEXT,
  "userId" TEXT,
  "anonymousSessionId" TEXT,
  "productId" TEXT NOT NULL,
  "surface" TEXT NOT NULL DEFAULT 'FOR_YOU',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationClick_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecommendationImpression_userId_fkey'
  ) THEN
    ALTER TABLE "RecommendationImpression"
      ADD CONSTRAINT "RecommendationImpression_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecommendationClick_impressionId_fkey'
  ) THEN
    ALTER TABLE "RecommendationClick"
      ADD CONSTRAINT "RecommendationClick_impressionId_fkey"
      FOREIGN KEY ("impressionId") REFERENCES "RecommendationImpression"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecommendationClick_productId_fkey'
  ) THEN
    ALTER TABLE "RecommendationClick"
      ADD CONSTRAINT "RecommendationClick_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecommendationClick_userId_fkey'
  ) THEN
    ALTER TABLE "RecommendationClick"
      ADD CONSTRAINT "RecommendationClick_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RecommendationImpression_userId_createdAt_idx"
  ON "RecommendationImpression"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationImpression_anonymousSessionId_createdAt_idx"
  ON "RecommendationImpression"("anonymousSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationImpression_surface_createdAt_idx"
  ON "RecommendationImpression"("surface", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationImpression_algorithm_createdAt_idx"
  ON "RecommendationImpression"("algorithm", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationClick_impressionId_createdAt_idx"
  ON "RecommendationClick"("impressionId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationClick_userId_createdAt_idx"
  ON "RecommendationClick"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationClick_anonymousSessionId_createdAt_idx"
  ON "RecommendationClick"("anonymousSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationClick_productId_createdAt_idx"
  ON "RecommendationClick"("productId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationClick_surface_createdAt_idx"
  ON "RecommendationClick"("surface", "createdAt");
