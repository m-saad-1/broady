-- Broady schema alignment migration.
-- Converts the legacy text taxonomy columns into the current enum-backed product schema.

-- CreateEnum
CREATE TYPE "ProductGender" AS ENUM ('MEN', 'WOMEN', 'BOYS', 'GIRLS', 'UNISEX');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('TOP', 'BOTTOM', 'FOOTWEAR', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "ProductDepartment" AS ENUM ('CLOTHING', 'FOOTWEAR', 'ACCESSORIES');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM (
  'SHIRTS',
  'T_SHIRTS',
  'POLOS',
  'JEANS',
  'TROUSERS',
  'SHORTS',
  'HOODIES',
  'JACKETS',
  'SNEAKERS',
  'LOAFERS',
  'SANDALS',
  'CAPS',
  'BAGS',
  'BELTS',
  'SOCKS',
  'SWEATSHIRTS',
  'JOGGERS',
  'CARGO_PANTS',
  'FORMAL_PANTS',
  'CHINOS',
  'KURTAS',
  'SHALWAR_KAMEEZ',
  'WAISTCOATS',
  'BLAZERS',
  'COATS',
  'SWEATERS',
  'CARDIGANS',
  'VESTS',
  'TANK_TOPS',
  'DRESSES',
  'SKIRTS',
  'LEGGINGS',
  'BOOTS',
  'FLATS',
  'HEELS',
  'SLIPPERS',
  'WATCHES',
  'SUNGLASSES',
  'WALLETS',
  'SCARVES',
  'TIES'
);

-- CreateEnum
CREATE TYPE "ProductSubcategory" AS ENUM (
  'TEXTURED_SHIRT',
  'EMBROIDERED_SHIRT',
  'KNIT_SHIRT',
  'PRINTED_SHIRT',
  'FORMAL_SHIRT',
  'CASUAL_SHIRT',
  'DENIM_SHIRT',
  'FLANNEL_SHIRT',
  'OXFORD_SHIRT',
  'LINEN_SHIRT',
  'GRAPHIC_TSHIRT',
  'PLAIN_TSHIRT',
  'OVERSIZED_TSHIRT',
  'HENLEY_TSHIRT',
  'V_NECK_TSHIRT',
  'CREW_NECK_TSHIRT',
  'POCKET_TSHIRT',
  'STRIPED_TSHIRT',
  'PIQUE_POLO',
  'TIPPED_POLO',
  'CLASSIC_POLO',
  'PERFORMANCE_POLO',
  'SLIM_FIT_JEANS',
  'REGULAR_FIT_JEANS',
  'RELAXED_FIT_JEANS',
  'SKINNY_JEANS',
  'STRAIGHT_LEG_JEANS',
  'BOOTCUT_JEANS',
  'DISTRESSED_JEANS',
  'DARK_WASH_JEANS',
  'LIGHT_WASH_JEANS',
  'RAW_DENIM_JEANS',
  'CHINO_TROUSERS',
  'DRESS_TROUSERS',
  'PLEATED_TROUSERS',
  'FLAT_FRONT_TROUSERS',
  'CARGO_SHORTS',
  'DENIM_SHORTS',
  'CHINO_SHORTS',
  'ATHLETIC_SHORTS',
  'SWIM_SHORTS',
  'ZIP_HOODIE',
  'PULLOVER_HOODIE',
  'GRAPHIC_HOODIE',
  'FLEECE_HOODIE',
  'BOMBER_JACKET',
  'DENIM_JACKET',
  'LEATHER_JACKET',
  'WINDBREAKER',
  'PUFFER_JACKET',
  'VARSITY_JACKET',
  'RUNNING_SNEAKER',
  'LIFESTYLE_SNEAKER',
  'TRAINING_SNEAKER',
  'CASUAL_SNEAKER',
  'HIGH_TOP_SNEAKER',
  'LOW_TOP_SNEAKER',
  'CANVAS_SNEAKER',
  'SLIP_ON_SNEAKER',
  'FORMAL_LOAFER',
  'CASUAL_LOAFER',
  'PENNY_LOAFER',
  'TASSEL_LOAFER',
  'SLIDE_SANDAL',
  'FLIP_FLOP_SANDAL',
  'SPORT_SANDAL',
  'GLADIATOR_SANDAL',
  'BASEBALL_CAP',
  'SNAPBACK_CAP',
  'FITTED_CAP',
  'TRUCKER_CAP',
  'BEANIE',
  'BUCKET_HAT',
  'BACKPACK',
  'MESSENGER_BAG',
  'TOTE_BAG',
  'DUFFLE_BAG',
  'CROSSBODY_BAG',
  'CLUTCH',
  'LEATHER_BELT',
  'CANVAS_BELT',
  'BRAIDED_BELT',
  'REVERSIBLE_BELT',
  'DRESS_SOCKS',
  'ATHLETIC_SOCKS',
  'ANKLE_SOCKS',
  'NO_SHOW_SOCKS'
);

-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK', 'PREORDER', 'DISCONTINUED');

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "material" TEXT;

UPDATE "Product"
SET "colors" = CASE
  WHEN "color" IS NULL OR "color" = 'default' THEN ARRAY[]::TEXT[]
  ELSE ARRAY["color"]
END;

ALTER TABLE "Product"
  RENAME COLUMN "subType" TO "subcategory";

ALTER TABLE "Product"
  ALTER COLUMN "gender" DROP DEFAULT,
  ALTER COLUMN "gender" TYPE "ProductGender" USING UPPER("gender")::"ProductGender",
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE "ProductCategory" USING UPPER("category")::"ProductCategory",
  ALTER COLUMN "department" DROP DEFAULT,
  ALTER COLUMN "department" TYPE "ProductDepartment" USING UPPER("department")::"ProductDepartment",
  ALTER COLUMN "productType" DROP DEFAULT,
  ALTER COLUMN "productType" TYPE "ProductType" USING UPPER("productType")::"ProductType",
  ALTER COLUMN "availabilityStatus" DROP DEFAULT,
  ALTER COLUMN "availabilityStatus" TYPE "ProductAvailability" USING CASE UPPER("availabilityStatus")
    WHEN 'AVAILABLE' THEN 'IN_STOCK'
    WHEN 'IN_STOCK' THEN 'IN_STOCK'
    WHEN 'OUT_OF_STOCK' THEN 'OUT_OF_STOCK'
    WHEN 'LOW_STOCK' THEN 'LOW_STOCK'
    WHEN 'PREORDER' THEN 'PREORDER'
    WHEN 'DISCONTINUED' THEN 'DISCONTINUED'
    ELSE 'IN_STOCK'
  END::"ProductAvailability";

ALTER TABLE "Product"
  ALTER COLUMN "availabilityStatus" SET DEFAULT 'IN_STOCK',
  ALTER COLUMN "subcategory" TYPE "ProductSubcategory" USING CASE
    WHEN "subcategory" IS NULL OR "subcategory" = '' THEN NULL
    ELSE UPPER("subcategory")::"ProductSubcategory"
  END;

DROP INDEX IF EXISTS "Product_brandId_topCategory_subCategory_idx";
DROP INDEX IF EXISTS "Product_gender_division_category_idx";
DROP INDEX IF EXISTS "Product_subType_idx";
DROP INDEX IF EXISTS "Product_topCategory_subCategory_idx";

ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "color",
  DROP COLUMN IF EXISTS "topCategory",
  DROP COLUMN IF EXISTS "subCategory",
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "division",
  DROP COLUMN IF EXISTS "mappingStatus",
  DROP COLUMN IF EXISTS "resolutionSource",
  DROP COLUMN IF EXISTS "subTypeConfidence";

CREATE INDEX IF NOT EXISTS "Product_gender_department_category_idx" ON "Product"("gender", "department", "category");
CREATE INDEX IF NOT EXISTS "Product_brandId_category_subcategory_idx" ON "Product"("brandId", "category", "subcategory");
CREATE INDEX IF NOT EXISTS "Product_category_subcategory_idx" ON "Product"("category", "subcategory");
CREATE INDEX IF NOT EXISTS "Product_department_category_idx" ON "Product"("department", "category");
CREATE INDEX IF NOT EXISTS "Product_productType_idx" ON "Product"("productType");
CREATE INDEX IF NOT EXISTS "Product_classificationConfidence_idx" ON "Product"("classificationConfidence");
CREATE INDEX IF NOT EXISTS "Product_availabilityStatus_isActive_idx" ON "Product"("availabilityStatus", "isActive");
