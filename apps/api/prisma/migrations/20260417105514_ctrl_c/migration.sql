-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'FLAGGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE', 'OFFENSIVE_LANGUAGE', 'FAKE_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewModerationAction" AS ENUM ('HIDE', 'UNHIDE', 'FLAG', 'REMOVE');

-- CreateEnum
CREATE TYPE "ProductTemplateType" AS ENUM ('SIZE_GUIDE', 'DELIVERIES_RETURNS', 'SHIPPING_DELIVERY', 'FABRIC_CARE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_REVIEW_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_REVIEW_REPORTED';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_REVIEW_MODERATED';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_REVIEW_REPLIED';

-- DropIndex
DROP INDEX "Product_search_document_trgm_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveriesReturns" JSONB,
ADD COLUMN     "deliveriesReturnsTemplateId" TEXT,
ADD COLUMN     "fabricCare" JSONB,
ADD COLUMN     "fabricCareTemplateId" TEXT,
ADD COLUMN     "shippingDelivery" JSONB,
ADD COLUMN     "shippingDeliveryTemplateId" TEXT,
ADD COLUMN     "sizeGuide" JSONB,
ADD COLUMN     "sizeGuideTemplateId" TEXT;

-- CreateTable
CREATE TABLE "ProductContentTemplate" (
    "id" TEXT NOT NULL,
    "type" "ProductTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "brandId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductContentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(120),
    "content" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
    "moderatedById" TEXT,
    "moderationReason" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewImage" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHelpfulnessVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewHelpfulnessVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewModerationLog" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "action" "ReviewModerationAction" NOT NULL,
    "moderatorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandReviewReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReviewAggregate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "rating1" INTEGER NOT NULL DEFAULT 0,
    "rating2" INTEGER NOT NULL DEFAULT 0,
    "rating3" INTEGER NOT NULL DEFAULT 0,
    "rating4" INTEGER NOT NULL DEFAULT 0,
    "rating5" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReviewAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductContentTemplate_type_idx" ON "ProductContentTemplate"("type");

-- CreateIndex
CREATE INDEX "ProductContentTemplate_brandId_type_idx" ON "ProductContentTemplate"("brandId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductContentTemplate_name_type_brandId_key" ON "ProductContentTemplate"("name", "type", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_createdAt_idx" ON "Review"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_brandId_status_createdAt_idx" ON "Review"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewImage_reviewId_sortOrder_idx" ON "ReviewImage"("reviewId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReviewHelpfulnessVote_reviewId_idx" ON "ReviewHelpfulnessVote"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHelpfulnessVote_reviewId_userId_key" ON "ReviewHelpfulnessVote"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_status_createdAt_idx" ON "ReviewReport"("reviewId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewReport_reportedByUserId_createdAt_idx" ON "ReviewReport"("reportedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewModerationLog_reviewId_createdAt_idx" ON "ReviewModerationLog"("reviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandReviewReply_reviewId_key" ON "BrandReviewReply"("reviewId");

-- CreateIndex
CREATE INDEX "BrandReviewReply_brandId_createdAt_idx" ON "BrandReviewReply"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReviewAggregate_productId_key" ON "ProductReviewAggregate"("productId");

-- AddForeignKey
ALTER TABLE "ProductContentTemplate" ADD CONSTRAINT "ProductContentTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductContentTemplate" ADD CONSTRAINT "ProductContentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulnessVote" ADD CONSTRAINT "ReviewHelpfulnessVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulnessVote" ADD CONSTRAINT "ReviewHelpfulnessVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModerationLog" ADD CONSTRAINT "ReviewModerationLog_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModerationLog" ADD CONSTRAINT "ReviewModerationLog_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewReply" ADD CONSTRAINT "BrandReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewReply" ADD CONSTRAINT "BrandReviewReply_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewReply" ADD CONSTRAINT "BrandReviewReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReviewAggregate" ADD CONSTRAINT "ProductReviewAggregate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
