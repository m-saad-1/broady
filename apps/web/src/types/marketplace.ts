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

export type ProductTemplateType = "SIZE_GUIDE" | "DELIVERIES_RETURNS" | "SHIPPING_DELIVERY" | "FABRIC_CARE";

export type ImportSourceType =
  | "SHOPIFY_JSON"
  | "WOOCOMMERCE_JSON"
  | "CUSTOM_JSON"
  | "CSV"
  | "REST_API"
  | "MANUAL_UPLOAD";

export type ImportJobStatus = "PENDING" | "PROCESSING" | "PARTIAL_SUCCESS" | "SUCCESS" | "FAILED" | "CANCELLED";
export type ImportLogLevel = "INFO" | "WARN" | "ERROR";

export type ImportLogRecord = {
  id: string;
  importJobId: string;
  productId?: string | null;
  level: ImportLogLevel;
  code?: string | null;
  message: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

export type ImportJobRecord = {
  id: string;
  brandId: string;
  sourceType: ImportSourceType;
  sourceLabel?: string | null;
  sourceLocation?: string | null;
  status: ImportJobStatus;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  startedAt?: string | null;
  completedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  logs?: ImportLogRecord[];
  brand?: Brand;
};

export type IngestionQueueStats = {
  wait?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
  paused?: number;
};

export type IngestionQueueMetrics = Record<string, IngestionQueueStats>;

export type CatalogFilterOptions = {
  availableGenders: Array<{ value: string; label: string; count: number }>;
  availableDepartments: Array<{ value: string; label: string; count: number }>;
  availableCategories: Array<{ value: string; label: string; count: number }>;
  availableSubcategories: Array<{ value: string; label: string; count: number }>;
  availableBrands: Array<{ id: string; name: string; slug: string; count: number }>;
  availableSizes: Array<{ value: string; count: number }>;
  availableColors: Array<{ value: string; count: number }>;
  availableFits?: Array<{ value: string; count: number }>;
  availableMaterials?: Array<{ value: string; count: number }>;
  priceRange: { min: number; max: number };
  totalCount: number;
};

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

export type UserAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country: string;
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
  updatedBy: "SYSTEM" | "BRAND" | "ADMIN" | "USER";
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
  courierName?: string | null;
  estimatedDelivery?: string | null;
  deliveryAttempts?: number;
  failureReason?: string | null;
  nextAttemptDate?: string | null;
  finalDeliveryFailureAt?: string | null;
  refundProcessedAt?: string | null;
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
  returnRequests?: Array<{
    id: string;
    status: string;
    requestType?: "RETURN" | "EXCHANGE" | null;
    preferredResolution?: string | null;
    reasonCode?: string | null;
    reasonText?: string | null;
    customerNote?: string | null;
    orderItemIds?: string[];
    replacementStatus?: string | null;
    replacementUnavailable?: boolean;
    convertedToRefund?: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type UserOrder = {
  id: string;
  status: OrderStatus;
  paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
  paymentStatus: PaymentStatus;
  paymentRetryEligible?: boolean;
  paymentRetryExpiresAt?: string | null;
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
    courierName?: string | null;
    estimatedDelivery?: string | null;
    deliveryAttempts?: number;
    failureReason?: string | null;
    nextAttemptDate?: string | null;
    finalDeliveryFailureAt?: string | null;
    refundProcessedAt?: string | null;
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
    returnRequests?: Array<{
      id: string;
      status: string;
      requestType?: "RETURN" | "EXCHANGE" | null;
      preferredResolution?: string | null;
      reasonCode?: string | null;
      reasonText?: string | null;
      customerNote?: string | null;
      orderItemIds?: string[];
      replacementStatus?: string | null;
      replacementUnavailable?: boolean;
      convertedToRefund?: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  statusLogs: OrderStatusLog[];
  returnRequests?: Array<{
    id: string;
    status: string;
    requestType?: "RETURN" | "EXCHANGE" | null;
    preferredResolution?: string | null;
    reasonCode?: string | null;
    reasonText?: string | null;
    customerNote?: string | null;
    orderItemIds?: string[];
    replacementStatus?: string | null;
    replacementUnavailable?: boolean;
    convertedToRefund?: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type CancellationRequestStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED_BY_USER";

export type CancellationRequestRecord = {
  id: string;
  orderId: string;
  subOrderId: string;
  brandId: string;
  status: CancellationRequestStatus;
  requestedByRole: "USER" | "BRAND" | "ADMIN" | "SYSTEM";
  reasonCode: string;
  reasonText: string;
  requesterNote?: string | null;
  brandResponseCode?: string | null;
  brandResponseNote?: string | null;
  trackingEvidence?: string | null;
  evidenceUrl?: string | null;
  decisionNote?: string | null;
  respondedAt?: string | null;
  decidedAt?: string | null;
  expiresAt?: string | null;
  autoApproveAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; userId?: string; paymentMethod?: string; paymentStatus?: string; createdAt?: string };
  brand?: Pick<Brand, "id" | "name">;
  subOrder?: {
    id: string;
    status: OrderStatus;
    subtotalPkr?: number;
    brand?: Pick<Brand, "id" | "name">;
    items?: Array<{
      id: string;
      quantity: number;
      product?: Pick<Product, "id" | "name" | "imageUrl">;
    }>;
  };
  history?: Array<{ id: string; action: string; note?: string | null; createdAt: string }>;
};

export type ReturnRequestStatus =
  | "REQUESTED"
  | "BRAND_REVIEWING"
  | "NEED_MORE_EVIDENCE"
  | "BRAND_APPROVED"
  | "BRAND_REJECTED"
  | "ADMIN_REVIEWING"
  | "ADMIN_APPROVED"
  | "ADMIN_REJECTED"
  | "REVIEWING"
  | "APPROVED"
  | "REJECTED"
  | "RETURN_ARRANGED"
  | "PICKUP_SCHEDULED"
  | "RETURN_IN_TRANSIT"
  | "IN_TRANSIT"
  | "RETURN_RECEIVED"
  | "RETURN_CONDITION_APPROVED"
  | "RETURN_CONDITION_DISPUTED"
  | "RECEIVED"
  | "REFUND_INITIATED"
  | "REFUND_PROCESSING"
  | "REFUND_COMPLETED"
  | "REPLACEMENT_PROCESSING"
  | "REPLACEMENT_PACKED"
  | "REPLACEMENT_READY_FOR_PICKUP"
  | "REPLACEMENT_SHIPPED"
  | "REPLACEMENT_OUT_FOR_DELIVERY"
  | "REPLACEMENT_DELIVERY_FAILED"
  | "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
  | "REPLACEMENT_READY_FOR_REDELIVERY"
  | "REPLACEMENT_SHIPMENT_RETURNED"
  | "REPLACEMENT_DELIVERED"
  | "COMPLETED"
  | "EXCHANGE_COMPLETED";

export type ReturnRequestRecord = {
  id: string;
  orderId: string;
  subOrderId: string;
  requestType?: "RETURN" | "EXCHANGE" | null;
  status: ReturnRequestStatus;
  orderItemIds?: string[];
  reasonCode: string;
  reasonText: string;
  customerNote?: string | null;
  preferredResolution?: string;
  requestedExchangeType?: string | null;
  requestedVariantSummary?: string | null;
  requestedReplacementVariantId?: string | null;
  requestedReplacementSize?: string | null;
  requestedReplacementColor?: string | null;
  customerRefundPreference?: string | null;
  evidenceImageUrls?: string[];
  brandRecommendation?: "APPROVE" | "REJECT" | "NEED_MORE_EVIDENCE" | null;
  brandRejectReason?: string | null;
  brandRecommendationNote?: string | null;
  brandConditionNote?: string | null;
  brandDamageNote?: string | null;
  canFulfillReplacement?: boolean | null;
  brandRecommendedAt?: string | null;
  replacementUnavailable?: boolean;
  replacementUnavailableReason?: string | null;
  damageEvidenceUrls?: string[];
  damageClaimNote?: string | null;
  damageClaimSubmittedAt?: string | null;
  convertedToRefund?: boolean;
  replacementStatus?:
    | "EXCHANGE_APPROVED"
    | "REPLACEMENT_PROCESSING"
    | "REPLACEMENT_PACKED"
    | "REPLACEMENT_READY_FOR_PICKUP"
    | "REPLACEMENT_SHIPPED"
    | "REPLACEMENT_OUT_FOR_DELIVERY"
    | "REPLACEMENT_DELIVERY_FAILED"
    | "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
    | "REPLACEMENT_READY_FOR_REDELIVERY"
    | "REPLACEMENT_SHIPMENT_RETURNED"
    | "REPLACEMENT_DELIVERED"
    | "EXCHANGE_COMPLETED"
    | "EXCHANGE_UNFULFILLABLE"
    | null;
  replacementTrackingNo?: string | null;
  replacementCourier?: string | null;
  replacementSku?: string | null;
  replacementDispatchDate?: string | null;
  replacementEstimatedDelivery?: string | null;
  replacementShipmentNote?: string | null;
  replacementDeliveryAttempts?: number;
  replacementFailureReason?: string | null;
  replacementFailureReasonMessage?: string | null;
  replacementNextAttemptDate?: string | null;
  replacementLastAttemptAt?: string | null;
  replacementDeliveryFailedAt?: string | null;
  replacementFinalFailureAt?: string | null;
  replacementDeliveredAt?: string | null;
  adminDecision?: "APPROVED" | "REJECTED" | null;
  adminDecisionNote?: string | null;
  adminRejectedReason?: string | null;
  pickupCourier?: string | null;
  pickupDate?: string | null;
  pickupAddress?: string | null;
  returnTrackingNumber?: string | null;
  returnReceivedAt?: string | null;
  returnReceivedByBrandId?: string | null;
  returnReceiptConditionNote?: string | null;
  returnReceiptEvidenceUrls?: string[];
  refundStatusSnapshot?: string | null;
  noReceiptReportedAt?: string | null;
  reviewNote?: string | null;
  pickupTracking?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; userId?: string; paymentMethod?: string; createdAt?: string; user?: { id: string; fullName?: string; email?: string } };
  subOrder?: {
    id: string;
    status: OrderStatus;
    subtotalPkr?: number;
    brandId?: string;
    brand?: Pick<Brand, "id" | "name">;
    items?: Array<{
      id: string;
      quantity: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      unitPricePkr?: number;
      product?: Pick<Product, "id" | "name" | "imageUrl">;
    }>;
  };
  statusLogs?: Array<{ id: string; status: ReturnRequestStatus; updatedBy?: "SYSTEM" | "USER" | "BRAND" | "ADMIN" | null; note?: string | null; createdAt: string }>;
  history?: Array<{ id: string; newStatus?: ReturnRequestStatus; performedByRole?: "SYSTEM" | "USER" | "BRAND" | "ADMIN" | null; note?: string | null; createdAt: string }>;
  refundRequests?: Array<{
    id: string;
    status: RefundRequestStatus;
    amountPkr: number;
    adjustedAmountPkr?: number | null;
    method?: string | null;
    completedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type RefundRequestStatus = "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "FAILED";

export type RefundRequestRecord = {
  id: string;
  orderId: string;
  subOrderId: string;
  status: RefundRequestStatus;
  amountPkr: number;
  adjustedAmountPkr?: number | null;
  currency?: string;
  method?: string;
  reasonCode?: string;
  reasonText?: string;
  gatewayRefundId?: string | null;
  reviewNote?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; userId?: string; paymentMethod?: string };
  subOrder?: {
    id: string;
    brandId?: string;
    subtotalPkr?: number;
    status?: OrderStatus;
    brand?: Pick<Brand, "id" | "name">;
    items?: Array<{
      id: string;
      quantity: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      unitPricePkr?: number;
      product?: Pick<Product, "id" | "name" | "imageUrl">;
    }>;
  };
  returnRequest?: ReturnRequestRecord | null;
  items?: Array<{
    id: string;
    quantity: number;
    refundAmountPkr: number;
    orderItem?: {
      id: string;
      quantity?: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      product?: Pick<Product, "id" | "name" | "imageUrl">;
    };
  }>;
  statusLogs?: Array<{ id: string; status: RefundRequestStatus; note?: string | null; createdAt: string }>;
  history?: Array<{ id: string; oldStatus?: RefundRequestStatus | null; newStatus?: RefundRequestStatus; note?: string | null; adjustedAmount?: number | null; createdAt: string }>;
};

export type AdminOperationsRecord = {
  refundRequests: RefundRequestRecord[];
  returnRequests: ReturnRequestRecord[];
  failedDeliveries: Array<{
    id: string;
    orderId: string;
    status: OrderStatus;
    failureReason?: string | null;
    nextAttemptDate?: string | null;
      updatedAt: string;
      deliveryAttempts?: number;
      order?: { id: string; userId?: string; paymentMethod?: string };
      brand?: Pick<Brand, "id" | "name">;
    }>;
  stuckShipments: Array<{
    id: string;
    orderId: string;
    status: OrderStatus;
    trackingId?: string | null;
    updatedAt: string;
    order?: { id: string; userId?: string; paymentMethod?: string };
    brand?: Pick<Brand, "id" | "name">;
  }>;
  disputes: RefundRequestRecord[];
  escalations?: Record<string, unknown>;
};

export type CodAbuseUserRecord = {
  id: string;
  fullName: string;
  email: string;
  codRefusalCount: number;
  lastCodRefusalAt?: string | null;
  codReviewFlag: boolean;
  codReviewStatus: "CLEAR" | "FLAGGED" | "UNDER_REVIEW" | "RESTRICTED" | "BLOCKED";
  codReviewNote?: string | null;
  codBlockedAt?: string | null;
  codPrepaymentRequired: boolean;
  orders: Array<{
    id: string;
    createdAt: string;
    paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
    subOrders: Array<{
      id: string;
      failureReason?: string | null;
      finalDeliveryFailureAt?: string | null;
      updatedAt: string;
    }>;
  }>;
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
    pendingProducts: number;
    outOfStockProducts: number;
    totalOrders: number;
    openOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalSalesPkr: number;
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
    | "ACCOUNT_VERIFICATION"
    | "PASSWORD_RESET"
    | "PRODUCT_REVIEW_SUBMITTED"
    | "PRODUCT_REVIEW_REPORTED"
    | "PRODUCT_REVIEW_MODERATED"
    | "PRODUCT_REVIEW_REPLIED";
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
  targetPath?: string;
  order?: { id: string; status: OrderStatus; trackingId?: string | null };
  channels: Array<{
    id: string;
    channel: "DASHBOARD" | "EMAIL" | "PUSH" | "WHATSAPP";
    status: "SENT" | "QUEUED" | "FAILED";
    recipient: string;
  }>;
};

export type WalletTransactionRecord = {
  id: string;
  type: "CREDIT" | "DEBIT";
  sourceType: "REFUND" | "PAYMENT" | "ADJUSTMENT";
  amountPkr: number;
  balanceAfterPkr: number;
  note?: string | null;
  createdAt: string;
  order?: {
    id: string;
    paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
    paymentStatus: PaymentStatus;
    totalPkr: number;
  } | null;
  refundRequest?: {
    id: string;
    status: string;
    method: "ORIGINAL_SOURCE" | "BANK_TRANSFER" | "WALLET_CREDIT";
    amountPkr: number;
  } | null;
};

export type UserWallet = {
  id: string;
  userId: string;
  availableBalancePkr: number;
  totalCreditedPkr: number;
  totalDebitedPkr: number;
  createdAt: string;
  updatedAt: string;
  transactions: WalletTransactionRecord[];
};

export type PaymentSessionRecord = {
  id: string;
  orderId: string;
  userId: string;
  paymentMethod: "JAZZCASH" | "EASYPAISA";
  gateway: string;
  gatewayTransactionId: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMEOUT" | "EXPIRED";
  redirectUrl: string;
  expiresAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  lastErrorReason?: string | null;
  attemptNumber: number;
  retryEligible?: boolean;
  retryExpiresAt?: string | null;
  order?: UserOrder | {
    id: string;
    paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
    paymentStatus: PaymentStatus;
    totalPkr: number;
    deliveryAddress: string;
    items: Array<{
      id: string;
      quantity: number;
      unitPricePkr: number;
      selectedColor?: string | null;
      selectedSize?: string | null;
      product: Product;
      brand?: Brand;
    }>;
  };
};

export type SearchSuggestion = {
  id: string;
  label: string;
  query: string;
  topCategory?: "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";
  gender?: "Men" | "Women" | "Juniors";
  juniorCategory?: "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";
  productType?: "Top" | "Bottom" | "Footwear" | "Accessories";
  subCategory?: string;
  size?: string;
  color?: string;
  brand?: string;
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
    deliveryAttempts?: number;
    failureReason?: string | null;
    nextAttemptDate?: string | null;
    finalDeliveryFailureAt?: string | null;
    refundProcessedAt?: string | null;
    totalPkr: number;
    createdAt: string;
    updatedAt: string;
    user: { id: string; fullName: string; email: string };
    statusLogs: OrderStatusLog[];
    returnRequests?: Array<{
      id: string;
      status: string;
      requestType?: "RETURN" | "EXCHANGE" | null;
      preferredResolution?: string | null;
      reasonCode?: string | null;
      reasonText?: string | null;
      customerNote?: string | null;
      orderItemIds?: string[];
      replacementStatus?: string | null;
      replacementUnavailable?: boolean;
      convertedToRefund?: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
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
    outOfStockProducts: number;
    totalOrders: number;
    openOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalSalesPkr: number;
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
