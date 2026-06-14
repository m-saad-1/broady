import type { ImportSourceType } from "@prisma/client";

export type ImportInputPayload = {
  brandId: string;
  sourceType: ImportSourceType;
  sourceLabel?: string;
  sourceLocation?: string;
  fileBuffer?: Buffer;
  rawText?: string;
  rawJson?: unknown;
};

export type NormalizedVariant = {
  externalVariantId?: string;
  sku: string;
  barcode?: string;
  color?: string;
  colorHex?: string;
  size?: string;
  fit?: string;
  season?: string;
  style?: string;
  pricePkr: number;
  salePricePkr?: number;
  compareAtPricePkr?: number;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock";
  lowStockThreshold?: number;
  weight?: number;
  quantity?: number;
};

export type NormalizedImage = {
  sourceUrl: string;
  url: string;
  cdnUrl?: string;
  altText?: string;
  imageType?: "main" | "gallery" | "size_guide" | "swatch";
  isPrimary: boolean;
  sortOrder: number;
  dedupeHash?: string;
};

export type NormalizedProduct = {
  externalProductId?: string;
  externalSource?: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  gender: string;
  division: string;
  category: string;
  subType?: string;
  subTypeConfidence: "explicit" | "inferred" | "null";
  mappingStatus: "complete" | "partial" | "unresolved";
  resolutionSource:
    | "url_and_breadcrumb"
    | "url_only"
    | "breadcrumb_only"
    | "adapter_label"
    | "title_keyword"
    | "admin_manual"
    | "unresolved";
  pageContext?: Record<string, unknown>;
  color: string;
  colors?: string[];
  fit?: string;
  season?: string;
  collection?: string;
  productUrl?: string;
  visibility?: "visible" | "hidden";
  source?: string;
  type: string;
  topCategory: string;
  subCategory: string;
  actualPrice: number;
  salePrice?: number;
  discountPercentage?: number;
  pricePkr: number;
  currency?: string;
  label?: string;
  saleStartDate?: string;
  saleEndDate?: string;
  sizes: string[];
  tags: string[];
  imageUrl: string;
  sizeGuide?: {
    imageUrl?: string;
    entries?: Array<{
      size: string;
      cm: string;
      inches: string;
    }>;
    details?: string[];
  };
  deliveriesReturns?: {
    deliveryTime?: string;
    returnPolicy?: string;
    refundConditions?: string;
  };
  shippingDelivery?: {
    regions?: string[];
    estimatedDeliveryTime?: string;
    charges?: string;
  };
  fabricCare?: {
    fabricType?: string;
    careInstructions?: string[];
  };
  additionalInfo?: Array<{
    label: string;
    value: string;
  }>;
  detail?: {
    fabricComposition?: string;
    careGuide?: string;
    fitDetails?: string;
    modelDetails?: string;
    sizeGuideText?: string;
    sizeGuideImageUrl?: string;
    shippingDelivery?: string;
    returnExchangePolicy?: string;
    disclaimer?: string;
    materialDetails?: string;
    origin?: string;
    packageIncludes?: string;
  };
  shipping?: {
    estimatedDeliveryMinDays?: number;
    estimatedDeliveryMaxDays?: number;
    deliveryText?: string;
    shippingFee?: number;
    freeShippingAvailable?: boolean;
    codAvailable?: boolean;
    returnAvailable?: boolean;
    exchangeAvailable?: boolean;
    returnWindowDays?: number;
    exchangeWindowDays?: number;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    ogImageUrl?: string;
  };
  stock: number;
  metadata?: Record<string, unknown>;
  attributes: Array<{ key: string; value: string }>;
  variants: NormalizedVariant[];
  images: NormalizedImage[];
};

export type ParsedImportRecord = {
  externalId?: string;
  raw: Record<string, unknown>;
};

export type ValidationIssue = {
  code: string;
  message: string;
  level: "ERROR" | "WARN";
};
