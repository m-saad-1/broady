import type { Product } from "@/types/marketplace";

export function findRelatedProducts(
  currentProduct: Product,
  allProducts: Product[],
  limit: number = 4,
): Product[] {
  const sameGroup = allProducts.filter(
    (p) =>
      p.id !== currentProduct.id &&
      p.topCategory === currentProduct.topCategory &&
      p.subCategory === currentProduct.subCategory,
  );

  if (sameGroup.length >= limit) {
    return sameGroup.slice(0, limit);
  }

  const sameType = allProducts.filter(
    (p) =>
      p.id !== currentProduct.id &&
      p.topCategory === currentProduct.topCategory &&
      p.productType === currentProduct.productType &&
      p.subCategory !== currentProduct.subCategory,
  );

  return [...sameGroup, ...sameType].slice(0, limit);
}
