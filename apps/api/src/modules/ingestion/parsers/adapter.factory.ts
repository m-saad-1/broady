import type { ImportSourceType } from "@prisma/client";
import type { BrandAdapter } from "../adapters/adapter.interface.js";
import { CsvAdapter } from "../adapters/csv.adapter.js";
import { CustomJsonAdapter } from "../adapters/custom-json.adapter.js";
import { ShopifyAdapter } from "../adapters/shopify.adapter.js";

export function getAdapter(sourceType: ImportSourceType): BrandAdapter {
  if (sourceType === "CSV") return new CsvAdapter();
  if (sourceType === "SHOPIFY_JSON") return new ShopifyAdapter();
  return new CustomJsonAdapter();
}
