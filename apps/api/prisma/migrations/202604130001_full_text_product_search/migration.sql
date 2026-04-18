-- Full-text and trigram search support for product discovery.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "searchDocument" TEXT NOT NULL DEFAULT '';

UPDATE "Product" p
SET "searchDocument" = concat_ws(' ', p."name", p."description", b."name")
FROM "Brand" b
WHERE b."id" = p."brandId";

CREATE OR REPLACE FUNCTION "set_product_search_document"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  brand_name TEXT;
BEGIN
  SELECT b."name"
    INTO brand_name
  FROM "Brand" b
  WHERE b."id" = NEW."brandId";

  NEW."searchDocument" := concat_ws(' ', NEW."name", NEW."description", brand_name);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "refresh_products_for_brand_name_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Product"
  SET "searchDocument" = concat_ws(' ', "name", "description", NEW."name")
  WHERE "brandId" = NEW."id";

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "product_search_document_trigger" ON "Product";
CREATE TRIGGER "product_search_document_trigger"
BEFORE INSERT OR UPDATE OF "name", "description", "brandId"
ON "Product"
FOR EACH ROW
EXECUTE FUNCTION "set_product_search_document"();

DROP TRIGGER IF EXISTS "brand_search_document_refresh_trigger" ON "Brand";
CREATE TRIGGER "brand_search_document_refresh_trigger"
AFTER UPDATE OF "name"
ON "Brand"
FOR EACH ROW
EXECUTE FUNCTION "refresh_products_for_brand_name_change"();

CREATE INDEX IF NOT EXISTS "Product_search_document_fts_idx"
  ON "Product"
  USING GIN (to_tsvector('simple', coalesce("searchDocument", '')));

CREATE INDEX IF NOT EXISTS "Product_search_document_trgm_idx"
  ON "Product"
  USING GIN ("searchDocument" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Brand_name_trgm_idx"
  ON "Brand"
  USING GIN (lower("name") gin_trgm_ops);
