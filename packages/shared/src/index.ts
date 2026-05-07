export type UserRole = "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";

export type ProductTopCategory = "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";

export const CATALOG_TOP_CATEGORY_OPTIONS = ["Men", "Women", "Juniors"] as const;

export const JUNIOR_TOP_CATEGORIES = ["Toddler Boys", "Junior Boys", "Toddler Girls", "Junior Girls"] as const;

export type CatalogTopCategory = (typeof CATALOG_TOP_CATEGORY_OPTIONS)[number];

export type JuniorTopCategory = (typeof JUNIOR_TOP_CATEGORIES)[number];

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

export const GENDER_OPTIONS = ["Male", "Female", "Unisex"] as const;

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
  entries: Array<{
    size: string;
    cm: string;
    inches: string;
  }>;
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

export type Product = {
  id: string;
  brandId: string;
  createdAt?: string;
  updatedAt?: string;
  approvalStatus?: ProductApprovalStatus;
  name: string;
  slug: string;
  description: string;
  descriptionLong?: string;
  actualPrice: number;
  salePrice?: number;
  discountPercentage?: number;
  pricePkr: number;
  gender: string;
  color: string;
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
