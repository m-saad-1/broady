DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus'
      AND e.enumlabel = 'PROCESSING'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING' AFTER 'CONFIRMED';
  END IF;
END$$;

UPDATE "Order"
SET "status" = 'PROCESSING'
WHERE "status" IN ('PACKED', 'PARTIALLY_SHIPPED');

UPDATE "SubOrder"
SET "status" = 'PROCESSING'
WHERE "status" IN ('PACKED', 'PARTIALLY_SHIPPED');
