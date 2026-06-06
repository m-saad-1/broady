import type { Product } from "@/types/marketplace";

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function calculatePriceSimilarity(price: number, seedPrice: number) {
  if (!price || !seedPrice) return 0;
  const delta = Math.abs(price - seedPrice);
  return Math.max(0, 1 - delta / seedPrice);
}

function getTagSet(product: Product) {
  return new Set((product.tags || []).map((tag) => normalizeValue(tag)).filter(Boolean));
}

export function scoreRelatedProductMatch(currentProduct: Product, candidate: Product) {
  if (candidate.id === currentProduct.id) return 0;

  const sameTopCategory = candidate.topCategory === currentProduct.topCategory;
  const sameGender = candidate.gender === currentProduct.gender;
  if (!sameTopCategory && !sameGender) return 0;

  let score = 0;
  if (sameTopCategory) score += 3;
  if (sameGender) score += 1;
  if (candidate.subCategory === currentProduct.subCategory) score += 5;
  if (candidate.productType && candidate.productType === currentProduct.productType) score += 2.25;
  if (candidate.brandId === currentProduct.brandId) score += 1.25;
  if (normalizeValue(candidate.color) && normalizeValue(candidate.color) === normalizeValue(currentProduct.color)) score += 1;
  if (normalizeValue(candidate.fit) && normalizeValue(candidate.fit) === normalizeValue(currentProduct.fit)) score += 0.9;
  if (normalizeValue(candidate.season) && normalizeValue(candidate.season) === normalizeValue(currentProduct.season)) score += 0.5;

  const currentTags = getTagSet(currentProduct);
  const tagOverlap = (candidate.tags || []).filter((tag) => currentTags.has(normalizeValue(tag))).length;
  score += Math.min(tagOverlap, 5) * 0.35;

  const currentSizes = new Set((currentProduct.sizes || []).map((size) => normalizeValue(size)).filter(Boolean));
  const sizeOverlap = (candidate.sizes || []).filter((size) => currentSizes.has(normalizeValue(size))).length;
  score += Math.min(sizeOverlap, 4) * 0.15;

  score += calculatePriceSimilarity(candidate.pricePkr || candidate.actualPrice, currentProduct.pricePkr || currentProduct.actualPrice) * 2;

  return score;
}

export function findRelatedProducts(
  currentProduct: Product,
  allProducts: Product[],
  limit: number = 8,
): Product[] {
  return allProducts
    .map((product) => ({
      product,
      score: scoreRelatedProductMatch(currentProduct, product),
    }))
    .filter((entry) => entry.score >= 5.75)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.product);
}

export function mergeRelatedProducts(primary: Product[], fallback: Product[], limit: number = 8) {
  const seen = new Set<string>();
  const merged: Product[] = [];

  for (const product of [...primary, ...fallback]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
    if (merged.length >= limit) break;
  }

  return merged;
}
