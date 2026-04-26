-- CreateEnum
CREATE TYPE "UserActivityEventType" AS ENUM (
  'PRODUCT_VIEW',
  'PRODUCT_ADDED_TO_CART',
  'PRODUCT_PURCHASED',
  'SEARCH_QUERY',
  'CATEGORY_BROWSE',
  'WISHLIST_ADDED'
);

-- CreateTable
CREATE TABLE "UserActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT,
  "eventType" "UserActivityEventType" NOT NULL,
  "searchQuery" TEXT,
  "topCategory" TEXT,
  "subCategory" TEXT,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_eventType_createdAt_idx" ON "UserActivity"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_productId_eventType_createdAt_idx" ON "UserActivity"("productId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
