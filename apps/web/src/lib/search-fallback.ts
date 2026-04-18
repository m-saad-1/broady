import type { Product } from "@/types/marketplace";

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function isEligibleSearchQuery(query: string, minLength = 3) {
  return normalizeSearchQuery(query).length >= minLength;
}

export function filterProductsBySubCategoryContains(
  products: Product[],
  query: string,
) {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 3) {
    return [];
  }

  return products.filter((product) =>
    product.subCategory.toLowerCase().includes(normalized),
  );
}
