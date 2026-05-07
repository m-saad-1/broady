import { Meilisearch } from "meilisearch";
import { env } from "../../config/env.js";
import { resolveMeilisearchApiKey } from "../../config/meilisearch.js";
import { PRODUCTS_INDEX_UID } from "../search/meilisearch.product-document.js";
import { expandCatalogTopCategory } from "./products.search-utils.js";

/** Mirrors `productTypeMap` in `products.routes.ts` for filter parity. */
const productTypeSubcategories: Record<string, string[]> = {
  Top: ["T-Shirts", "Polo Shirts", "Shirts", "V-Neck", "Formal Shirts", "Hoodies", "Sweatshirts", "Jackets", "Outerwear", "Dresses", "Skirts", "Shorts"],
  Bottom: ["Jeans", "Trousers", "Joggers", "Cargo Pants", "Skirts", "Shorts"],
  Footwear: ["Sneakers", "Boots", "Sandals", "Slip Ons", "Loafers", "Derby", "Oxfords", "Ankle Boots"],
  Accessories: ["Bags", "Belts", "Caps", "Jewelry", "Socks", "Scarves"],
};

export type MeilisearchProductSearchFilters = {
  brand?: string;
  topCategory?: string;
  juniorCategory?: string;
  productType?: string;
  subCategory?: string;
  subCategoryHints?: string[];
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  shouldEnforceNameMatch?: boolean;
  nameMatchTokens?: string[];
};

function meiliQuote(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function createSearchClient(): Meilisearch {
  const apiKey = resolveMeilisearchApiKey("search").trim() || resolveMeilisearchApiKey("admin").trim();
  return new Meilisearch({
    host: env.meilisearchUrl,
    ...(apiKey ? { apiKey } : {}),
  });
}

/** When unset: enabled for non-localhost hosts if a search/admin key exists. Set `MEILISEARCH_ENABLE_PRODUCT_SEARCH=false` to force Postgres only. */
export function isMeilisearchProductSearchEnabled(): boolean {
  const opt = process.env.MEILISEARCH_ENABLE_PRODUCT_SEARCH?.trim().toLowerCase();
  if (opt === "false" || opt === "0") return false;
  if (opt === "true" || opt === "1") return true;

  let host = "";
  try {
    host = new URL(env.meilisearchUrl).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1") return false;

  const key = resolveMeilisearchApiKey("search").trim() || resolveMeilisearchApiKey("admin").trim();
  return Boolean(key);
}

function buildMeilisearchFilters(filters: MeilisearchProductSearchFilters): string[] {
  const parts: string[] = [`isActive = true`, `approvalStatus = "APPROVED"`];

  if (filters.brand) {
    parts.push(`brandSlug = "${meiliQuote(filters.brand)}"`);
  }

  const topVals = expandCatalogTopCategory(filters.topCategory, filters.juniorCategory);
  if (topVals.length === 1) {
    parts.push(`topCategory = "${meiliQuote(topVals[0]!)}"`);
  } else if (topVals.length > 1) {
    parts.push(`(${topVals.map((t) => `topCategory = "${meiliQuote(t)}"`).join(" OR ")})`);
  }

  if (filters.productType && productTypeSubcategories[filters.productType]) {
    const subs = productTypeSubcategories[filters.productType]!;
    if (filters.subCategory) {
      parts.push(`subCategory = "${meiliQuote(filters.subCategory)}"`);
    } else {
      parts.push(`(${subs.map((s) => `subCategory = "${meiliQuote(s)}"`).join(" OR ")})`);
    }
  } else if (filters.subCategory) {
    parts.push(`subCategory = "${meiliQuote(filters.subCategory)}"`);
  }

  if (filters.size) {
    parts.push(`sizes = "${meiliQuote(filters.size)}"`);
  }

  if (typeof filters.minPrice === "number") {
    parts.push(`pricePkr >= ${filters.minPrice}`);
  }
  if (typeof filters.maxPrice === "number") {
    parts.push(`pricePkr <= ${filters.maxPrice}`);
  }

  return parts;
}

export async function runMeilisearchProductSearch(q: string, filters: MeilisearchProductSearchFilters): Promise<string[]> {
  const client = createSearchClient();
  const index = client.index(PRODUCTS_INDEX_UID);
  const filterParts = buildMeilisearchFilters(filters);

  const res = await index.search(q, {
    limit: 100,
    filter: filterParts.length ? filterParts : undefined,
    attributesToSearchOn: filters.shouldEnforceNameMatch ? (["name"] as const) : undefined,
  });

  const ids = res.hits.map((hit) => (hit as { id?: string }).id).filter((id): id is string => Boolean(id));
  return ids;
}
