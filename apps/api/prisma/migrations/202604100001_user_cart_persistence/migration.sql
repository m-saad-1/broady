ALTER TABLE "CartItem"
ADD COLUMN "selectedColor" TEXT,
ADD COLUMN "selectedSize" TEXT;

DROP INDEX IF EXISTS "CartItem_cartId_productId_key";

CREATE UNIQUE INDEX "CartItem_cartId_productId_selectedColor_selectedSize_key"
ON "CartItem"("cartId", "productId", "selectedColor", "selectedSize");
