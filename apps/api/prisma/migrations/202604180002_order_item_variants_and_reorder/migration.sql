-- Persist selected variant choices on order items for transparent order details.
ALTER TABLE "OrderItem"
ADD COLUMN "selectedColor" TEXT,
ADD COLUMN "selectedSize" TEXT;
