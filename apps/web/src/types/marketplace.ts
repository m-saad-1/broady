import type {
  Brand as SharedBrand,
  OrderStatus as SharedOrderStatus,
  PaymentStatus as SharedPaymentStatus,
  Product as SharedProduct,
  UserRole,
} from "@broady/shared";

export type Brand = SharedBrand;

export type Product = SharedProduct;

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

export type ProductTemplateType = "SIZE_GUIDE" | "DELIVERIES_RETURNS" | "SHIPPING_DELIVERY" | "FABRIC_CARE";

export type ProductContentTemplate = {
  id: string;
  type: ProductTemplateType;
  name: string;
  content: ProductSizeGuide | ProductDeliveriesReturns | ProductShippingDelivery | ProductFabricCare;
  brandId?: string | null;
  brand?: Pick<Brand, "id" | "name" | "slug">;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  brandId?: string | null;
};

export type BrandWithProducts = Brand & {
  products: Product[];
};

export type UserPaymentType = "CARD" | "JAZZCASH" | "EASYPAISA" | "BANK";

export type UserPaymentMethod = {
  id: string;
  type: UserPaymentType;
  label: string;
  last4: string;
  expiresMonth?: number | null;
  expiresYear?: number | null;
  isDefault: boolean;
};

export type NotificationPreference = {
  id: string;
  userId: string;
  orderUpdates: boolean;
  promoEmails: boolean;
  securityAlerts: boolean;
  wishlistAlerts: boolean;
};

export type OrderStatus = SharedOrderStatus;

export type PaymentStatus = SharedPaymentStatus;

export type OrderStatusLog = {
  id: string;
  status: OrderStatus;
  updatedBy: "SYSTEM" | "BRAND" | "ADMIN";
  updatedById?: string | null;
  note?: string | null;
  createdAt: string;
};

export type BrandDashboardOrder = {
  id: string;
  status: OrderStatus;
  paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
  paymentStatus: PaymentStatus;
  totalPkr: number;
  deliveryAddress: string;
  trackingId?: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; email: string };
  items: Array<{
    id: string;
    quantity: number;
    unitPricePkr: number;
    selectedColor?: string | null;
    selectedSize?: string | null;
    product: Product;
    brand?: Brand;
  }>;
  statusLogs: OrderStatusLog[];
};

export type UserOrder = {
  id: string;
  status: OrderStatus;
  paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
  paymentStatus: PaymentStatus;
  totalPkr: number;
  deliveryAddress: string;
  trackingId?: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; email: string };
  items: Array<{
    id: string;
    quantity: number;
    unitPricePkr: number;
    selectedColor?: string | null;
    selectedSize?: string | null;
    product: Product;
    brand?: Brand;
  }>;
  subOrders: Array<{
    id: string;
    orderId: string;
    brandId: string;
    status: OrderStatus;
    subtotalPkr: number;
    trackingId?: string | null;
    createdAt: string;
    updatedAt: string;
    brand: Brand;
    items: Array<{
      id: string;
      quantity: number;
      unitPricePkr: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      product: Product;
      brand?: Brand;
    }>;
    statusLogs: OrderStatusLog[];
  }>;
  statusLogs: OrderStatusLog[];
};

export type BrandDashboardOverview = {
  brand: Brand & {
    commissionRate: number;
    apiEnabled: boolean;
    contactEmail?: string | null;
    whatsappNumber?: string | null;
  };
  metrics: {
    totalProducts: number;
    activeProducts: number;
    grossPkr: number;
    estimatedNetPkr: number;
    commissionRate: number;
    orderItems: number;
    byStatus: Record<string, number>;
  };
  recentOrders: BrandDashboardOrder[];
};

export type NotificationItem = {
  id: string;
  type:
    | "ORDER_PLACED"
    | "ORDER_STATUS_UPDATED"
    | "BRAND_ORDER_ASSIGNED"
    | "PRODUCT_REVIEW_SUBMITTED"
    | "PRODUCT_REVIEW_REPORTED"
    | "PRODUCT_REVIEW_MODERATED"
    | "PRODUCT_REVIEW_REPLIED";
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
  order?: { id: string; status: OrderStatus; trackingId?: string | null };
  channels: Array<{
    id: string;
    channel: "DASHBOARD" | "EMAIL" | "WHATSAPP";
    status: "SENT" | "QUEUED" | "FAILED";
    recipient: string;
  }>;
};

export type SearchSuggestion = {
  id: string;
  label: string;
  query: string;
  topCategory?: "Men" | "Women" | "Kids";
  kind: "query" | "product";
};

export type BrandProvisioningResponse = {
  brand: Brand & {
    commissionRate?: number;
    apiEnabled?: boolean;
    contactEmail?: string | null;
    whatsappNumber?: string | null;
  };
  account: User;
  inviteUrl: string;
  brandEmail: string;
};

export type AdminBrandDashboardRecord = {
  brand: Brand & {
    contactEmail?: string | null;
    whatsappNumber?: string | null;
    commissionRate: number;
    apiEnabled: boolean;
    createdAt: string;
  };
  products: Product[];
  orders: Array<{
    id: string;
    status: OrderStatus;
    paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
    paymentStatus: PaymentStatus;
    deliveryAddress: string;
    trackingId?: string | null;
    totalPkr: number;
    createdAt: string;
    updatedAt: string;
    user: { id: string; fullName: string; email: string };
    statusLogs: OrderStatusLog[];
    items: Array<{
      id: string;
      quantity: number;
      unitPricePkr: number;
      createdAt: string;
      product: Product;
    }>;
  }>;
  metrics: {
    totalProducts: number;
    activeProducts: number;
    pendingProducts: number;
    totalOrders: number;
    grossPkr: number;
    statusCounts: Record<string, number>;
  };
};

export type ReviewStatus = "VISIBLE" | "HIDDEN" | "FLAGGED" | "REMOVED";

export type ReviewReportReason = "SPAM" | "INAPPROPRIATE" | "OFFENSIVE_LANGUAGE" | "FAKE_REVIEW" | "OTHER";

export type ReviewReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export type ProductReviewAggregate = {
  averageRating: number;
  totalReviews: number;
  rating1: number;
  rating2: number;
  rating3: number;
  rating4: number;
  rating5: number;
};

export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  brandId: string;
  orderItemId: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
  };
  product?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
  };
  orderItem?: {
    id: string;
    selectedColor?: string | null;
    selectedSize?: string | null;
    order?: {
      id: string;
    };
  };
  images: Array<{
    id: string;
    url: string;
    sortOrder: number;
  }>;
  brandReply?: {
    id: string;
    brandId: string;
    userId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      fullName: string;
    };
  } | null;
  _count?: {
    helpfulnessVotes: number;
    reports: number;
  };
};

export type ProductReviewsResponse = {
  total: number;
  limit: number;
  skip: number;
  items: ProductReview[];
  aggregate: ProductReviewAggregate;
};

export type ReviewReport = {
  id: string;
  reviewId: string;
  reportedByUserId: string;
  reason: ReviewReportReason;
  description?: string | null;
  status: ReviewReportStatus;
  resolutionNote?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

export type AdminReviewReportRecord = ReviewReport & {
  review: ProductReview & {
    product: {
      id: string;
      name: string;
      slug: string;
    };
  };
  reportedByUser: {
    id: string;
    fullName: string;
    email: string;
  };
  resolvedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};
