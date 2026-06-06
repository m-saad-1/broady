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

function isWithinSaleWindow(product: Product, at: number) {
  const start = toTimestamp(product.saleStartDate || undefined);
  const end = toTimestamp(product.saleEndDate || undefined);
  if (start && at < start) return false;
  if (end && at > end) return false;
  return true;
}

export function hasActiveOffer(product: Product, at = Date.now()) {
  if (!isWithinSaleWindow(product, typeof at === "number" ? at : Date.now())) return false;
  const basePrice = Math.max(0, Math.round(product.actualPrice || product.pricePkr));
  const explicitSale = typeof product.salePrice === "number" ? Math.max(0, Math.round(product.salePrice)) : null;
  const finalPrice = explicitSale ?? Math.max(0, Math.round(product.pricePkr));
  return basePrice > 0 && finalPrice > 0 && finalPrice < basePrice;
}

export function getProductPricing(product: Product, at = Date.now()): ProductPricing {
  const basePrice = Math.max(0, Math.round(product.actualPrice || product.pricePkr));
  const saleCandidate =
    typeof product.salePrice === "number"
      ? Math.max(0, Math.round(product.salePrice))
      : Math.max(0, Math.round(product.pricePkr));
  const hasDiscount = hasActiveOffer(product, typeof at === "number" ? at : Date.now());

  let discountPercentage = 0;
  if (hasDiscount && typeof product.discountPercentage === "number") {
    discountPercentage = clampDiscount(product.discountPercentage);
  }

  if (hasDiscount && (!discountPercentage || discountPercentage <= 0) && basePrice > 0) {
    discountPercentage = clampDiscount(Math.round(((basePrice - saleCandidate) / basePrice) * 100));
  }

  const finalPrice = hasDiscount ? saleCandidate : basePrice;
  const discountAmount = hasDiscount ? Math.max(0, basePrice - finalPrice) : 0;

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountPercentage,
    hasDiscount,
  };
}
