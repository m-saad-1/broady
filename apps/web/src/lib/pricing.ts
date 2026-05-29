import type { Product } from "@/types/marketplace";

type ProductPricing = {
  basePrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercentage: number;
  hasDiscount: boolean;
};

function clampDiscount(percentage: number) {
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(90, Math.max(0, Math.round(percentage)));
}

function toTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function hasActiveOffer(product: Product) {
  if (typeof product.discountPercentage === "number" && product.discountPercentage > 0) return true;
  if (typeof product.salePrice === "number") {
    const base = Math.max(0, Math.round(product.pricePkr));
    const sale = Math.max(0, Math.round(product.salePrice));
    return sale < base;
  }
  return false;
}

export function getProductPricing(product: Product, at = Date.now()): ProductPricing {
  const basePrice = Math.max(0, Math.round(product.pricePkr));

  const hasDiscount = hasActiveOffer(product);

  // Determine discount percentage: prefer explicit field, otherwise derive from salePrice
  let discountPercentage = 0;
  if (typeof product.discountPercentage === "number") {
    discountPercentage = clampDiscount(product.discountPercentage);
  } else if (typeof product.salePrice === "number" && basePrice > 0) {
    const sale = Math.max(0, Math.round(product.salePrice));
    discountPercentage = clampDiscount(Math.round(((basePrice - sale) / basePrice) * 100));
  }

  const discountAmount = hasDiscount ? Math.round((basePrice * discountPercentage) / 100) : 0;

  // finalPrice prefers explicit salePrice when provided
  let finalPrice = basePrice - discountAmount;
  if (typeof product.salePrice === "number") {
    finalPrice = Math.max(0, Math.round(product.salePrice));
  }

  finalPrice = Math.max(0, finalPrice);

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountPercentage,
    hasDiscount,
  };
}
