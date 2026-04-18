export type UserRole = "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";

export type ProductTopCategory = "Men" | "Women" | "Kids";

export type ProductType = "Top" | "Bottom" | "Footwear" | "Accessories";

export type ProductApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ProductBadge = "Sale" | "New" | "Limited" | "Out of Stock";

export type PaymentMethod = "COD" | "JAZZCASH" | "EASYPAISA";

export type PaymentStatus = "PENDING" | "HELD" | "BRAND_COLLECTS_COD" | "COMPLETED";

export type OrderStatus = "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELED";

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
  pricePkr: number;
  topCategory: ProductTopCategory;
  productType?: ProductType;
  subCategory: string;
  sizes: string[];
  sizeGuideTemplateId?: string;
  sizeGuide?: ProductSizeGuide;
  deliveriesReturnsTemplateId?: string;
  deliveriesReturns?: ProductDeliveriesReturns;
  shippingDeliveryTemplateId?: string;
  shippingDelivery?: ProductShippingDelivery;
  fabricCareTemplateId?: string;
  fabricCare?: ProductFabricCare;
  colors?: string[];
  badge?: ProductBadge;
  imageUrl: string;
  stock: number;
  isActive: boolean;
  offer?: {
    percentage: number;
    isActive?: boolean;
    startsAt?: string;
    endsAt?: string;
  };
  brand?: Brand;
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
