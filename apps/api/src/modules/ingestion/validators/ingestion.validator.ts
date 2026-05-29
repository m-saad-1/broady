import type { NormalizedProduct, ValidationIssue } from "../ingestion.types.js";

const VALID_TOP_CATEGORIES = new Set(["Men", "Women", "Juniors"]);

export function validateNormalizedProduct(product: NormalizedProduct): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!product.name.trim()) issues.push({ code: "REQUIRED_NAME", message: "Product name is required", level: "ERROR" });
  if (!product.slug.trim()) issues.push({ code: "REQUIRED_SLUG", message: "Product slug is required", level: "ERROR" });
  if (product.actualPrice < 0) issues.push({ code: "INVALID_PRICE", message: "Actual price cannot be negative", level: "ERROR" });
  if (!product.imageUrl) issues.push({ code: "MISSING_IMAGE", message: "Primary image missing", level: "WARN" });
  if (!VALID_TOP_CATEGORIES.has(product.gender)) issues.push({ code: "INVALID_GENDER", message: `Unknown gender ${product.gender}`, level: "WARN" });
  if (!product.subCategory.trim()) issues.push({ code: "INVALID_CATEGORY", message: "Subcategory is required", level: "ERROR" });

  const seenSkus = new Set<string>();
  for (const variant of product.variants) {
    if (!variant.sku.trim()) {
      issues.push({ code: "MISSING_SKU", message: "Variant SKU missing", level: "ERROR" });
      continue;
    }
    if (seenSkus.has(variant.sku)) {
      issues.push({ code: "DUPLICATE_SKU", message: `Duplicate SKU in payload: ${variant.sku}`, level: "ERROR" });
    }
    seenSkus.add(variant.sku);
  }

  return issues;
}
