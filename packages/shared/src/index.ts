export type UserRole = "USER" | "ADMIN" | "BRAND" | "BRAND_ADMIN" | "BRAND_STAFF" | "SUPER_ADMIN";

export const BROADY_GENDER_VALUES = ["men", "women", "boys", "girls", "unisex"] as const;
export type BroadyGender = (typeof BROADY_GENDER_VALUES)[number];

export const BROADY_DIVISION_VALUES = ["top", "bottom", "footwear", "accessory"] as const;
export type BroadyDivision = (typeof BROADY_DIVISION_VALUES)[number];

export const BROADY_CATEGORY_VALUES = [
  "shirt",
  "t-shirt",
  "polo",
  "hoodie",
  "sweatshirt",
  "jacket",
  "coat",
  "sweater",
  "vest",
  "blouse",
  "top",
  "kurta",
  "trouser",
  "pant",
  "jeans",
  "shorts",
  "skirt",
  "jogger",
  "cargo",
  "sneaker",
  "trainer",
  "loafer",
  "sandal",
  "slipper",
  "boot",
  "formal_shoe",
  "open_shoe",
  "closed_shoe",
  "bag",
  "cap",
  "belt",
  "watch",
  "wallet",
  "socks",
  "scarf",
  "sunglasses",
  "jewellery",
  "underwear",
] as const;
export type BroadyCategory = (typeof BROADY_CATEGORY_VALUES)[number];

export const BROADY_SUB_TYPE_VALUES = [
  "basic",
  "knit",
  "embedded",
  "textured",
  "printed",
  "denim",
  "flannel",
  "linen",
  "formal",
  "casual",
  "pique",
  "striped",
  "graphic",
  "oversized",
  "pullover",
  "zip-up",
  "low-top",
  "high-top",
  "chunky",
  "slip-on",
  "running",
  "leather",
  "bomber",
  "windbreaker",
  "quilted",
  "boxer",
  "brief",
] as const;
export type BroadySubType = (typeof BROADY_SUB_TYPE_VALUES)[number];

export const BROADY_MAPPING_STATUS_VALUES = ["complete", "partial", "unresolved"] as const;
export type BroadyMappingStatus = (typeof BROADY_MAPPING_STATUS_VALUES)[number];

export const BROADY_RESOLUTION_SOURCE_VALUES = [
  "url_and_breadcrumb",
  "url_only",
  "breadcrumb_only",
  "adapter_label",
  "title_keyword",
  "admin_manual",
  "unresolved",
] as const;
export type BroadyResolutionSource = (typeof BROADY_RESOLUTION_SOURCE_VALUES)[number];

export const BROADY_SUB_TYPE_CONFIDENCE_VALUES = ["explicit", "inferred", "null"] as const;
export type BroadySubTypeConfidence = (typeof BROADY_SUB_TYPE_CONFIDENCE_VALUES)[number];

export const BROADY_CATEGORIES_BY_DIVISION: Record<BroadyDivision, readonly BroadyCategory[]> = {
  top: ["shirt", "t-shirt", "polo", "hoodie", "sweatshirt", "jacket", "coat", "sweater", "vest", "blouse", "top", "kurta"],
  bottom: ["trouser", "pant", "jeans", "shorts", "skirt", "jogger", "cargo", "underwear"],
  footwear: ["sneaker", "trainer", "loafer", "sandal", "slipper", "boot", "formal_shoe", "open_shoe", "closed_shoe"],
  accessory: ["bag", "cap", "belt", "watch", "wallet", "socks", "scarf", "sunglasses", "jewellery"],
};

export const BROADY_SUB_TYPES_BY_CATEGORY: Partial<Record<BroadyCategory, readonly BroadySubType[]>> = {
  shirt: ["basic", "knit", "embedded", "textured", "printed", "denim", "flannel", "linen", "formal", "casual"],
  polo: ["basic", "pique", "striped", "printed"],
  "t-shirt": ["basic", "graphic", "printed", "striped", "oversized"],
  hoodie: ["pullover", "zip-up", "printed", "basic"],
  sneaker: ["low-top", "high-top", "chunky", "slip-on", "running"],
  jacket: ["denim", "leather", "bomber", "windbreaker", "quilted"],
  underwear: ["boxer", "brief", "basic", "printed", "striped"],
};

const CATEGORY_TO_DIVISION = Object.entries(BROADY_CATEGORIES_BY_DIVISION).reduce<Record<string, BroadyDivision>>((acc, [division, categories]) => {
  for (const category of categories) {
    acc[category] = division as BroadyDivision;
  }
  return acc;
}, {});

export function getBroadyDivisionForCategory(category?: string | null): BroadyDivision | undefined {
  if (!category) return undefined;
  return CATEGORY_TO_DIVISION[category];
}

export function categorySupportsSubTypes(category?: string | null) {
  if (!category) return false;
  return Boolean(BROADY_SUB_TYPES_BY_CATEGORY[category as BroadyCategory]?.length);
}

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
  | "READY_FOR_PICKUP"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERY_FAILED"
  | "ADDRESS_CORRECTION_REQUIRED"
  | "READY_FOR_REDELIVERY"
  | "SHIPMENT_RETURNED"
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

export type ProductRawImportData = {
  id: string;
  importJobId: string;
  productId?: string | null;
  externalId?: string | null;
  payload?: Record<string, unknown> | null;
  normalizedHash?: string | null;
  createdAt?: string;
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
  normalizedGender?: BroadyGender | null;
  division?: BroadyDivision | null;
  category?: BroadyCategory | null;
  subType?: BroadySubType | null;
  subTypeConfidence?: BroadySubTypeConfidence | null;
  mappingStatus?: BroadyMappingStatus | null;
  resolutionSource?: BroadyResolutionSource | null;
  pageContext?: Record<string, unknown> | null;
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
  importRawData?: ProductRawImportData[];
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

export type CourierName = "Leopards" | "TCS" | "Call Courier" | "Trax" | "Other";

export interface CourierConfig {
  name: CourierName;
  displayName: string;
  trackingUrlPattern: (trackingNumber: string) => string;
  description: string;
}

export const COURIERS: Record<CourierName, CourierConfig> = {
  Leopards: {
    name: "Leopards",
    displayName: "Leopards Courier",
    trackingUrlPattern: (trackingNumber) => `https://track.leopardscourier.com/?track=${encodeURIComponent(trackingNumber)}`,
    description: "Leopards Express Courier Service",
  },
  TCS: {
    name: "TCS",
    displayName: "TCS Courier",
    trackingUrlPattern: (trackingNumber) => `https://www.tcsexpress.com/Tracking/?cn=${encodeURIComponent(trackingNumber)}`,
    description: "TCS Express Courier Service",
  },
  "Call Courier": {
    name: "Call Courier",
    displayName: "Call Courier",
    trackingUrlPattern: (trackingNumber) =>
      `https://www.callcourier.com.pk/tracking-system/?reference=${encodeURIComponent(trackingNumber)}`,
    description: "Call Courier Service",
  },
  Trax: {
    name: "Trax",
    displayName: "Trax Courier",
    trackingUrlPattern: (trackingNumber) => `https://www.traxpk.com/Tracking/?cn=${encodeURIComponent(trackingNumber)}`,
    description: "Trax Express Courier Service",
  },
  Other: {
    name: "Other",
    displayName: "Other Courier",
    trackingUrlPattern: (trackingNumber) => `${trackingNumber}`,
    description: "Custom/Other Courier Service",
  },
};

export function getAvailableCouriers(): CourierName[] {
  return Object.keys(COURIERS) as CourierName[];
}

export function getCourierConfig(name: string): CourierConfig | null {
  const normalizedName = Object.keys(COURIERS).find((key) => key.toLowerCase() === name.toLowerCase());
  return normalizedName ? COURIERS[normalizedName as CourierName] : null;
}

export function getTrackingUrl(courierName: string, trackingNumber: string): string | null {
  const config = getCourierConfig(courierName);
  if (!config) return null;
  return config.trackingUrlPattern(trackingNumber);
}

export function isValidCourierName(name: string): name is CourierName {
  return Object.keys(COURIERS).some((key) => key.toLowerCase() === name.toLowerCase());
}

export function formatCourierName(name: string): string {
  const config = getCourierConfig(name);
  return config ? config.displayName : name;
}
