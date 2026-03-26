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

export function hasActiveOffer(product: Product, at = Date.now()) {
  const offer = product.offer;
  if (!offer) return false;

  const percentage = clampDiscount(offer.percentage);
  if (percentage <= 0) return false;
  if (offer.isActive === false) return false;

  const startsAt = toTimestamp(offer.startsAt);
  const endsAt = toTimestamp(offer.endsAt);
  if (startsAt !== null && at < startsAt) return false;
  if (endsAt !== null && at > endsAt) return false;

  return true;
}

export function getProductPricing(product: Product, at = Date.now()): ProductPricing {
  const basePrice = Math.max(0, Math.round(product.pricePkr));
  const hasDiscount = hasActiveOffer(product, at);
  const discountPercentage = hasDiscount ? clampDiscount(product.offer?.percentage || 0) : 0;
  const discountAmount = hasDiscount ? Math.round((basePrice * discountPercentage) / 100) : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountPercentage,
    hasDiscount,
  };
}
