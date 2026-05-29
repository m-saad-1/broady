-- Broady product structure pipeline.
-- Adds first-class product details, shipping, SEO, import metadata, and richer variant/media fields.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "shortDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "fit" TEXT,
  ADD COLUMN IF NOT EXISTS "season" TEXT,
  ADD COLUMN IF NOT EXISTS "collection" TEXT,
  ADD COLUMN IF NOT EXISTS "productUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "saleStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "saleEndDate" TIMESTAMP(3);

ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "externalVariantId" TEXT,
  ADD COLUMN IF NOT EXISTS "colorHex" TEXT,
  ADD COLUMN IF NOT EXISTS "fit" TEXT,
  ADD COLUMN IF NOT EXISTS "compareAtPricePkr" INTEGER,
  ADD COLUMN IF NOT EXISTS "stockStatus" TEXT NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER,
  ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;

ALTER TABLE "ProductImage"
  ADD COLUMN IF NOT EXISTS "cdnUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "altText" TEXT,
  ADD COLUMN IF NOT EXISTS "imageType" TEXT NOT NULL DEFAULT 'gallery';

CREATE TABLE IF NOT EXISTS "ProductDetail" (
  "productId" TEXT NOT NULL,
  "fabricComposition" TEXT,
  "careGuide" TEXT,
  "fitDetails" TEXT,
  "modelDetails" TEXT,
  "sizeGuideText" TEXT,
  "sizeGuideImageUrl" TEXT,
  "shippingDelivery" TEXT,
  "returnExchangePolicy" TEXT,
  "disclaimer" TEXT,
  "materialDetails" TEXT,
  "origin" TEXT,
  "packageIncludes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductDetail_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductShipping" (
  "productId" TEXT NOT NULL,
  "estimatedDeliveryMinDays" INTEGER,
  "estimatedDeliveryMaxDays" INTEGER,
  "deliveryText" TEXT,
  "shippingFee" INTEGER,
  "freeShippingAvailable" BOOLEAN,
  "codAvailable" BOOLEAN,
  "returnAvailable" BOOLEAN,
  "exchangeAvailable" BOOLEAN,
  "returnWindowDays" INTEGER,
  "exchangeWindowDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductShipping_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductShipping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductSEO" (
  "productId" TEXT NOT NULL,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "canonicalUrl" TEXT,
  "ogImageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductSEO_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductSEO_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductImportMeta" (
  "productId" TEXT NOT NULL,
  "importBatchId" TEXT,
  "sourceFormat" TEXT,
  "sourceBrandName" TEXT,
  "rawProductData" JSONB,
  "mappingStatus" TEXT,
  "validationErrors" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductImportMeta_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductImportMeta_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProductVariant_productId_color_size_idx" ON "ProductVariant"("productId", "color", "size");
CREATE INDEX IF NOT EXISTS "ProductImage_productId_imageType_idx" ON "ProductImage"("productId", "imageType");
CREATE INDEX IF NOT EXISTS "ProductImportMeta_importBatchId_idx" ON "ProductImportMeta"("importBatchId");
CREATE INDEX IF NOT EXISTS "ProductImportMeta_sourceFormat_mappingStatus_idx" ON "ProductImportMeta"("sourceFormat", "mappingStatus");
