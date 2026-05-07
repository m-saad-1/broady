import type { Product } from "@/types/marketplace";

function calculateSimilarityScore(productA: Product, productB: Product): number {
  let score = 0;

  // Prioritize sub-category match
  if (productA.subCategory && productA.subCategory === productB.subCategory) {
    score += 50;
  }

  // Add points for product type match
  if (productA.productType && productA.productType === productB.productType) {
    score += 30;
  }

  // Add points for shared tags
  if (productA.tags?.length && productB.tags?.length) {
      const tagsA = productA.tags;
      const tagsB = productB.tags;
    const sharedTags = tagsA.filter(tag => tagsB.includes(tag));
    score += sharedTags.length * 20;
  }

  // Add minor points for top-category match as a fallback
  if (productA.topCategory === productB.topCategory) {
    score += 10;
  }
  
  // Add points for same gender
  if (productA.gender && productA.gender === productB.gender) {
    score += 15;
  }

  return score;
}

export function findRelatedProducts(
  currentProduct: Product,
  allProducts: Product[],
  limit: number = 4,
): Product[] {
  const scoredProducts = allProducts
    .filter((p) => p.id !== currentProduct.id)
    .map((p) => ({
      product: p,
      score: calculateSimilarityScore(currentProduct, p),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Fallback to simple category matching if no good matches are found
  if (scoredProducts.length < limit) {
    const fallbackProducts = allProducts.filter(
      (p) =>
        p.id !== currentProduct.id &&
        p.topCategory === currentProduct.topCategory &&
        !scoredProducts.some(sp => sp.product.id === p.id)
    );
    
    const combined = [...scoredProducts.map(item => item.product), ...fallbackProducts];
    return Array.from(new Set(combined.map(p => p.id))).map(id => combined.find(p => p.id === id) as Product).slice(0, limit);
  }

  return scoredProducts.slice(0, limit).map((item) => item.product);
}
