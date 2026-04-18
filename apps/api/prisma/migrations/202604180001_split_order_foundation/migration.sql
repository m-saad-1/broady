-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus'
      AND e.enumlabel = 'PARTIALLY_SHIPPED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_SHIPPED';
  END IF;
END
$$;

-- CreateTable
CREATE TABLE "SubOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalPkr" INTEGER NOT NULL,
    "trackingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubOrderStatusLog" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "updatedBy" "OrderStatusUpdatedBy" NOT NULL,
    "updatedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubOrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "subOrderId" TEXT;

-- Backfill: create one sub-order per (order, brand) based on existing order items
INSERT INTO "SubOrder" ("id", "orderId", "brandId", "status", "subtotalPkr", "createdAt", "updatedAt")
SELECT
  'so_' || substr(md5(random()::text || clock_timestamp()::text || oi."orderId" || oi."brandId"), 1, 24) AS "id",
  oi."orderId",
  oi."brandId",
  o."status",
  SUM(oi."quantity" * oi."unitPricePkr")::int AS "subtotalPkr",
  MIN(o."createdAt") AS "createdAt",
  NOW() AS "updatedAt"
FROM "OrderItem" oi
JOIN "Order" o ON o."id" = oi."orderId"
GROUP BY oi."orderId", oi."brandId", o."status";

-- Backfill: map existing order items to sub-orders
UPDATE "OrderItem" oi
SET "subOrderId" = so."id"
FROM "SubOrder" so
WHERE so."orderId" = oi."orderId"
  AND so."brandId" = oi."brandId";

-- Backfill: mirror existing order logs onto sub-orders for baseline history
INSERT INTO "SubOrderStatusLog" ("id", "subOrderId", "status", "updatedBy", "updatedById", "note", "createdAt")
SELECT
  'sol_' || substr(md5(random()::text || clock_timestamp()::text || osl."id" || so."id"), 1, 24) AS "id",
  so."id",
  osl."status",
  osl."updatedBy",
  osl."updatedById",
  osl."note",
  osl."createdAt"
FROM "OrderStatusLog" osl
JOIN "SubOrder" so ON so."orderId" = osl."orderId";

-- CreateIndex
CREATE UNIQUE INDEX "SubOrder_orderId_brandId_key" ON "SubOrder"("orderId", "brandId");
CREATE INDEX "SubOrder_brandId_status_idx" ON "SubOrder"("brandId", "status");
CREATE INDEX "SubOrder_orderId_createdAt_idx" ON "SubOrder"("orderId", "createdAt");
CREATE INDEX "OrderItem_subOrderId_idx" ON "OrderItem"("subOrderId");
CREATE INDEX "SubOrderStatusLog_subOrderId_createdAt_idx" ON "SubOrderStatusLog"("subOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubOrderStatusLog" ADD CONSTRAINT "SubOrderStatusLog_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
