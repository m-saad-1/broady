export type UserRole = "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";

export type ProductTopCategory = "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";

export type ProductGender = "Men" | "Women" | "Juniors";
export const PRODUCT_GENDER_OPTIONS = ["Men", "Women", "Juniors"] as const;

export const CATALOG_TOP_CATEGORY_OPTIONS = ["Men", "Women", "Juniors"] as const;

export const JUNIOR_TOP_CATEGORIES = ["Toddler Boys", "Junior Boys", "Toddler Girls", "Junior Girls"] as const;

export type CatalogTopCategory = (typeof CATALOG_TOP_CATEGORY_OPTIONS)[number];

export type JuniorTopCategory = (typeof JUNIOR_TOP_CATEGORIES)[number];
export type JuniorGroup = JuniorTopCategory;

export function isJuniorTopCategory(value: string): value is JuniorTopCategory {
  return (JUNIOR_TOP_CATEGORIES as readonly string[]).includes(value);
}

export function expandCatalogTopCategory(topCategory?: string, juniorCategory?: string) {
  if (!topCategory) {
    return [] as string[];
  }

  if (topCategory === "Juniors") {
    if (juniorCategory && isJuniorTopCategory(juniorCategory)) {
      return [juniorCategory];
    }

    return [...JUNIOR_TOP_CATEGORIES];
  }

  return [topCategory];
}

export type ProductType = "Top" | "Bottom" | "Footwear" | "Accessories";

export const PRODUCT_TYPE_OPTIONS = ["Top", "Bottom", "Footwear", "Accessories"] as const;

export const GENDER_OPTIONS = PRODUCT_GENDER_OPTIONS;

export type ProductApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ProductBadge = "Sale" | "New" | "Limited" | "Out of Stock";

export type PaymentMethod = "COD" | "JAZZCASH" | "EASYPAISA";

export type PaymentStatus = "PENDING" | "HELD" | "BRAND_COLLECTS_COD" | "COMPLETED" | "FAILED" | "REFUNDED";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERY_FAILED"
  | "ADDRESS_CORRECTION_REQUIRED"
  | "READY_FOR_REDELIVERY"
  | "DELIVERED"
  | "RETURNED"
  | "CANCELED";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  verified: boolean;
  commissionRate?: number;
  apiEnabled?: boolean;
  contactEmail?: string | null;
  whatsappNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductSizeGuide = {
  imageUrl?: string;
  entries?: Array<{
    size: string;
    cm: string;
    inches: string;
  }>;
  details?: string[];
};

export type ProductDeliveriesReturns = {
  deliveryTime: string;
  returnPolicy: string;
  refundConditions: string;
};

export type ProductShippingDelivery = {
  regions: string[];
  estimatedDeliveryTime: string;
  charges?: string;
};

export type ProductFabricCare = {
  fabricType: string;
  careInstructions: string[];
};

export type ProductDetailBlock = {
  fabricComposition?: string | null;
  careGuide?: string | null;
  fitDetails?: string | null;
  modelDetails?: string | null;
  sizeGuideText?: string | null;
  sizeGuideImageUrl?: string | null;
  shippingDelivery?: string | null;
  returnExchangePolicy?: string | null;
  disclaimer?: string | null;
  materialDetails?: string | null;
  origin?: string | null;
  packageIncludes?: string | null;
};

export type ProductShippingBlock = {
  estimatedDeliveryMinDays?: number | null;
  estimatedDeliveryMaxDays?: number | null;
  deliveryText?: string | null;
  shippingFee?: number | null;
  freeShippingAvailable?: boolean | null;
  codAvailable?: boolean | null;
  returnAvailable?: boolean | null;
  exchangeAvailable?: boolean | null;
  returnWindowDays?: number | null;
  exchangeWindowDays?: number | null;
};

export type ProductSEOBlock = {
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
};

export type ProductVariant = {
  id: string;
  externalVariantId?: string | null;
  sku: string;
  barcode?: string | null;
  color?: string | null;
  colorHex?: string | null;
  size?: string | null;
  fit?: string | null;
  season?: string | null;
  style?: string | null;
  pricePkr: number;
  salePricePkr?: number | null;
  compareAtPricePkr?: number | null;
  stockStatus?: string | null;
  lowStockThreshold?: number | null;
  weight?: number | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ProductMediaImage = {
  id: string;
  sourceUrl: string;
  url: string;
  cdnUrl?: string | null;
  altText?: string | null;
  imageType?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type Product = {
  id: string;
  brandId: string;
  createdAt?: string;
  updatedAt?: string;
  approvalStatus?: ProductApprovalStatus;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description: string;
  descriptionLong?: string;
  actualPrice: number;
  salePrice?: number;
  discountPercentage?: number;
  pricePkr: number;
  currency?: string;
  label?: string | null;
  saleStartDate?: string | null;
  saleEndDate?: string | null;
  gender: ProductGender;
  juniorsGroup?: JuniorGroup;
  color: string;
  colors?: string[];
  fit?: string;
  season?: string | null;
  collection?: string | null;
  productUrl?: string | null;
  visibility?: "visible" | "hidden" | string;
  source?: string | null;
  additionalInfo?: Array<{
    label: string;
    value: string;
  }>;
  productType?: ProductType;
  topCategory: ProductTopCategory;
  subCategory: string;
  sizes: string[];
  tags?: string[];
  sizeGuideTemplateId?: string;
  sizeGuide?: ProductSizeGuide;
  deliveriesReturnsTemplateId?: string;
  deliveriesReturns?: ProductDeliveriesReturns;
  shippingDeliveryTemplateId?: string;
  shippingDelivery?: ProductShippingDelivery;
  fabricCareTemplateId?: string;
  fabricCare?: ProductFabricCare;
  badge?: ProductBadge;
  imageUrl: string;
  stock: number;
  isActive: boolean;
  brand?: Brand;
  soldCount?: number;
  metadata?: Record<string, unknown>;
  detail?: ProductDetailBlock | null;
  shipping?: ProductShippingBlock | null;
  seo?: ProductSEOBlock | null;
  variants?: ProductVariant[];
  images?: ProductMediaImage[];
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  brandId?: string | null;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export * from "./couriers";
