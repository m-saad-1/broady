import type { Product } from "@/types/marketplace";

type BlendRecommendedProductsOptions = {
  recommended: Product[];
  products: Product[];
  limit?: number;
  recommendedSlots?: number;
  organicSlots?: number;
};

function dedupeProducts(products: Product[]) {
  const seen = new Set<string>();
  const deduped: Product[] = [];

  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    deduped.push(product);
  }

  return deduped;
}

export function shuffleProducts(products: Product[]) {
  const shuffled = [...products];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function blendRecommendedProducts({
  recommended,
  products,
  limit = 24,
  recommendedSlots = 2,
  organicSlots = 1,
}: BlendRecommendedProductsOptions) {
  const recommendedProducts = dedupeProducts(recommended);
  const organicProducts = dedupeProducts(products).filter(
    (product) => !recommendedProducts.some((recommendedProduct) => recommendedProduct.id === product.id),
  );
  const mixed: Product[] = [];
  let recommendedIndex = 0;
  let organicIndex = 0;

  while (mixed.length < limit && (recommendedIndex < recommendedProducts.length || organicIndex < organicProducts.length)) {
    for (let slot = 0; slot < recommendedSlots && mixed.length < limit && recommendedIndex < recommendedProducts.length; slot += 1) {
      mixed.push(recommendedProducts[recommendedIndex]);
      recommendedIndex += 1;
    }

    for (let slot = 0; slot < organicSlots && mixed.length < limit && organicIndex < organicProducts.length; slot += 1) {
      mixed.push(organicProducts[organicIndex]);
      organicIndex += 1;
    }

    if (recommendedIndex >= recommendedProducts.length && organicIndex < organicProducts.length) {
      mixed.push(...organicProducts.slice(organicIndex, organicIndex + limit - mixed.length));
      break;
    }
  }

  return dedupeProducts(mixed).slice(0, limit);
}

export function getRecommendationProductIds(products: Product[]) {
  return products.map((product) => product.id);
}
