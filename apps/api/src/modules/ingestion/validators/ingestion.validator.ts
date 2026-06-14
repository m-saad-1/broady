import type { NormalizedProduct, ValidationIssue } from "../ingestion.types.js";

const VALID_GENDERS = new Set(["men", "women", "boys", "girls"]);
const VALID_DIVISIONS = new Set(["top", "bottom", "footwear", "accessory"]);
const VALID_MAPPING_STATUSES = new Set(["complete", "partial", "unresolved"]);

export function validateNormalizedProduct(product: NormalizedProduct): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!product.name.trim()) issues.push({ code: "REQUIRED_NAME", message: "Product name is required", level: "ERROR" });
  if (!product.slug.trim()) issues.push({ code: "REQUIRED_SLUG", message: "Product slug is required", level: "ERROR" });
  if (product.actualPrice < 0) issues.push({ code: "INVALID_PRICE", message: "Actual price cannot be negative", level: "ERROR" });
  if (!product.imageUrl) issues.push({ code: "MISSING_IMAGE", message: "Primary image missing", level: "WARN" });
  if (!VALID_GENDERS.has(product.gender)) issues.push({ code: "INVALID_GENDER", message: `Unknown gender ${product.gender}`, level: "ERROR" });
  if (!VALID_DIVISIONS.has(product.division)) issues.push({ code: "INVALID_DIVISION", message: `Unknown division ${product.division}`, level: "ERROR" });
  if (!product.category.trim()) issues.push({ code: "INVALID_CATEGORY", message: "Canonical category is required", level: "ERROR" });
  if (!VALID_MAPPING_STATUSES.has(product.mappingStatus)) {
    issues.push({ code: "INVALID_MAPPING_STATUS", message: `Unknown mapping status ${product.mappingStatus}`, level: "ERROR" });
  }
  if (product.mappingStatus === "unresolved") {
    issues.push({ code: "UNRESOLVED_TAXONOMY", message: "Product taxonomy is unresolved and requires admin review", level: "WARN" });
  }

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
