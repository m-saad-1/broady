export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  verified: boolean;
};

export type Product = {
  id: string;
  brandId: string;
  approvalStatus?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  name: string;
  slug: string;
  description: string;
  descriptionLong?: string;
  pricePkr: number;
  topCategory: "Men" | "Women" | "Kids";
  productType?: "Top" | "Bottom" | "Footwear" | "Accessories";
  subCategory: string;
  sizes: string[];
  colors?: string[];
  badge?: "Sale" | "New" | "Limited" | "Out of Stock";
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
  role: "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";
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

export type OrderStatus = "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELED";

export type PaymentStatus = "PENDING" | "HELD" | "BRAND_COLLECTS_COD" | "COMPLETED";

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
    product: Product;
    brand?: Brand;
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
  type: "ORDER_PLACED" | "ORDER_STATUS_UPDATED" | "BRAND_ORDER_ASSIGNED";
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
