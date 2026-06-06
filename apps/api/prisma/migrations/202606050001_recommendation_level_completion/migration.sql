-- Complete Broady recommendation levels and tracking foundation.

ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'PRODUCT_REMOVED_FROM_CART';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'PRODUCT_RETURNED';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'PRODUCT_CANCELLED';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'FILTER_USED';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'CHECKOUT_STARTED';
ALTER TYPE "UserActivityEventType" ADD VALUE IF NOT EXISTS 'ORDER_PLACED';

ALTER TABLE "UserActivity"
  ADD COLUMN IF NOT EXISTS "variantId" TEXT,
  ADD COLUMN IF NOT EXISTS "brandId" TEXT,
  ADD COLUMN IF NOT EXISTS "filters" JSONB,
  ADD COLUMN IF NOT EXISTS "sourcePage" TEXT,
  ADD COLUMN IF NOT EXISTS "device" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT;

CREATE INDEX IF NOT EXISTS "UserActivity_brandId_eventType_createdAt_idx"
  ON "UserActivity"("brandId", "eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "UserActivity_topCategory_subCategory_createdAt_idx"
  ON "UserActivity"("topCategory", "subCategory", "createdAt");

CREATE TABLE IF NOT EXISTS "UserRecommendationProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "preferredGender" TEXT,
  "topCategories" JSONB NOT NULL DEFAULT '[]',
  "topSubCategories" JSONB NOT NULL DEFAULT '[]',
  "topBrands" JSONB NOT NULL DEFAULT '[]',
  "topColors" JSONB NOT NULL DEFAULT '[]',
  "topSizes" JSONB NOT NULL DEFAULT '[]',
  "topFits" JSONB NOT NULL DEFAULT '[]',
  "styleTags" JSONB NOT NULL DEFAULT '[]',
  "priceMinPkr" INTEGER,
  "priceMaxPkr" INTEGER,
  "lastAnonymousSessionId" TEXT,
  "lastBuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserRecommendationProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRecommendationProfile_userId_key"
  ON "UserRecommendationProfile"("userId");

CREATE INDEX IF NOT EXISTS "UserRecommendationProfile_preferredGender_lastBuiltAt_idx"
  ON "UserRecommendationProfile"("preferredGender", "lastBuiltAt");

CREATE INDEX IF NOT EXISTS "UserRecommendationProfile_lastBuiltAt_idx"
  ON "UserRecommendationProfile"("lastBuiltAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserRecommendationProfile_userId_fkey'
  ) THEN
    ALTER TABLE "UserRecommendationProfile"
      ADD CONSTRAINT "UserRecommendationProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
