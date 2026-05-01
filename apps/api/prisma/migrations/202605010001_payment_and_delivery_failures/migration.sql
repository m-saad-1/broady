DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus'
      AND e.enumlabel = 'OUT_FOR_DELIVERY'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY' AFTER 'SHIPPED';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus'
      AND e.enumlabel = 'DELIVERY_FAILED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_FAILED' AFTER 'OUT_FOR_DELIVERY';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus'
      AND e.enumlabel = 'RETURNED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED' AFTER 'DELIVERED';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentStatus'
      AND e.enumlabel = 'FAILED'
  ) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentStatus'
      AND e.enumlabel = 'REFUNDED'
  ) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
  END IF;
END$$;

ALTER TABLE "SubOrder"
ADD COLUMN IF NOT EXISTS "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
ADD COLUMN IF NOT EXISTS "nextAttemptDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "finalDeliveryFailureAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "refundProcessedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "gateway" "PaymentMethod" NOT NULL,
  "gatewayTransactionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountPkr" INTEGER NOT NULL,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_gatewayTransactionId_key" ON "PaymentTransaction"("gatewayTransactionId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_orderId_createdAt_idx" ON "PaymentTransaction"("orderId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentTransaction_orderId_fkey'
  ) THEN
    ALTER TABLE "PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
