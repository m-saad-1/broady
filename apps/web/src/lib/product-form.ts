import { z } from "zod";
import type { ProductMutationPayload } from "@/lib/api";
import type { Product } from "@/types/marketplace";

export type ProductFormValues = {
  brandId?: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  actualPrice: string;
  salePrice?: string;
  discountPercentage?: string;
  pricePkr: string;
  currency?: string;
  label?: string;
  saleStartDate?: string;
  saleEndDate?: string;
  gender: Product["gender"];
  color: string;
  fit?: string;
  season?: string;
  collection?: string;
  productUrl?: string;
  visibility?: "visible" | "hidden";
  source?: string;
  type: string;
  topCategory: Product["topCategory"];
  subCategory: string;
  sizes: string;
  tags?: string;
  imageUrl: string;
  sizeGuideTemplateId?: string;
  sizeGuideImageUrl?: string;
  sizeGuideRows: Array<{ size: string; cm: string; inches: string }>;
  deliveriesReturnsTemplateId?: string;
  deliveryTime: string;
  returnPolicy: string;
  refundConditions: string;
  shippingDeliveryTemplateId?: string;
  shippingRegions: string;
  shippingEstimatedDeliveryTime: string;
  shippingCharges?: string;
  fabricCareTemplateId?: string;
  fabricType: string;
  careInstructions: string;
  fabricComposition?: string;
  careGuide?: string;
  fitDetails?: string;
  modelDetails?: string;
  sizeGuideText?: string;
  detailSizeGuideImageUrl?: string;
  shippingDeliveryText?: string;
  returnExchangePolicy?: string;
  disclaimer?: string;
  materialDetails?: string;
  origin?: string;
  packageIncludes?: string;
  estimatedDeliveryMinDays?: string;
  estimatedDeliveryMaxDays?: string;
  deliveryText?: string;
  shippingFee?: string;
  freeShippingAvailable?: boolean;
  codAvailable?: boolean;
  returnAvailable?: boolean;
  exchangeAvailable?: boolean;
  returnWindowDays?: string;
  exchangeWindowDays?: string;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  stock: string;
  isActive?: boolean;
};

const productTopCategories = ["Men", "Women", "Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"] as const;

export { productTopCategories };

function isProductAssetUrl(value: string) {
  if (value.startsWith("/")) return true;

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function parseSizesCsv(sizes: string) {
  return sizes
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTagsCsv(tags: string | undefined) {
  if (!tags) return [];
  return tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLinesCsv(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanBlock<T extends Record<string, unknown>>(block: T): Partial<T> | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(block).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ""),
  ) as Partial<T>;
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

const optionalTemplateIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalPositiveNumberSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().positive("Value must be greater than 0").optional(),
);

const optionalPercentageSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().min(0).max(100).optional(),
);

const productFormSchema = z.object({
  brandId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters"),
  shortDescription: z.string().trim().optional(),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  actualPrice: z.coerce.number().positive("Actual price must be greater than 0"),
  salePrice: optionalPositiveNumberSchema,
  discountPercentage: optionalPercentageSchema,
  pricePkr: z.coerce.number().int().positive("Price must be greater than 0"),
  currency: z.string().trim().optional(),
  label: z.string().trim().optional(),
  saleStartDate: z.string().trim().optional(),
  saleEndDate: z.string().trim().optional(),
  gender: z.enum(["Men", "Women", "Juniors"]),
  color: z.string().trim().min(2, "Color is required"),
  fit: z.string().trim().optional(),
  season: z.string().trim().optional(),
  collection: z.string().trim().optional(),
  productUrl: z.string().trim().optional(),
  visibility: z.enum(["visible", "hidden"]).optional(),
  source: z.string().trim().optional(),
  type: z.enum(["Top", "Bottom", "Footwear", "Accessories"]),
  topCategory: z.enum(productTopCategories),
  subCategory: z.string().trim().min(2, "Sub-category must be at least 2 characters"),
  sizes: z.string().trim().min(1, "Add at least one size"),
  tags: z.string().trim().optional(),
  imageUrl: z
    .string()
    .trim()
    .min(1, "Image URL is required")
    .refine(isProductAssetUrl, {
      message: "Image URL must be an absolute http(s) URL or a root-relative asset path",
    }),
  sizeGuideTemplateId: optionalTemplateIdSchema,
  sizeGuideImageUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isProductAssetUrl(value), {
      message: "Size guide image must be an absolute http(s) URL or a root-relative asset path",
    }),
  sizeGuideRows: z
    .array(
      z.object({
        size: z.string().trim().min(1, "Size is required"),
        cm: z.string().trim().min(1, "CM measurement is required"),
        inches: z.string().trim().min(1, "Inches measurement is required"),
      }),
    )
    .optional(),
  deliveriesReturnsTemplateId: optionalTemplateIdSchema,
  deliveryTime: z.string().trim().optional(),
  returnPolicy: z.string().trim().optional(),
  refundConditions: z.string().trim().optional(),
  shippingDeliveryTemplateId: optionalTemplateIdSchema,
  shippingRegions: z.string().trim().optional(),
  shippingEstimatedDeliveryTime: z.string().trim().optional(),
  shippingCharges: z.string().trim().optional(),
  fabricCareTemplateId: optionalTemplateIdSchema,
  fabricType: z.string().trim().optional(),
  careInstructions: z.string().trim().optional(),
  fabricComposition: z.string().trim().optional(),
  careGuide: z.string().trim().optional(),
  fitDetails: z.string().trim().optional(),
  modelDetails: z.string().trim().optional(),
  sizeGuideText: z.string().trim().optional(),
  detailSizeGuideImageUrl: z.string().trim().optional(),
  shippingDeliveryText: z.string().trim().optional(),
  returnExchangePolicy: z.string().trim().optional(),
  disclaimer: z.string().trim().optional(),
  materialDetails: z.string().trim().optional(),
  origin: z.string().trim().optional(),
  packageIncludes: z.string().trim().optional(),
  estimatedDeliveryMinDays: z.string().trim().optional(),
  estimatedDeliveryMaxDays: z.string().trim().optional(),
  deliveryText: z.string().trim().optional(),
  shippingFee: z.string().trim().optional(),
  freeShippingAvailable: z.boolean().optional(),
  codAvailable: z.boolean().optional(),
  returnAvailable: z.boolean().optional(),
  exchangeAvailable: z.boolean().optional(),
  returnWindowDays: z.string().trim().optional(),
  exchangeWindowDays: z.string().trim().optional(),
  metaTitle: z.string().trim().optional(),
  metaDescription: z.string().trim().optional(),
  canonicalUrl: z.string().trim().optional(),
  ogImageUrl: z.string().trim().optional(),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  isActive: z.boolean().optional(),
});

const adminProductFormSchema = productFormSchema.extend({
  brandId: z.string().trim().min(1, "Select a brand"),
});

export { productFormSchema, adminProductFormSchema };

function buildProductPayloadFromParsed(data: z.infer<typeof productFormSchema>): Omit<ProductMutationPayload, "brandId"> {
  const sizeGuideImageUrl = data.detailSizeGuideImageUrl || data.sizeGuideImageUrl;

  return {
    name: data.name,
    slug: data.slug,
    shortDescription: data.shortDescription || undefined,
    description: data.description,
    actualPrice: data.actualPrice,
    salePrice: data.salePrice,
    discountPercentage: data.discountPercentage,
    pricePkr: data.pricePkr,
    currency: data.currency || "PKR",
    label: data.label || undefined,
    saleStartDate: data.saleStartDate || undefined,
    saleEndDate: data.saleEndDate || undefined,
    gender: data.gender,
    color: data.color,
    fit: data.fit || undefined,
    season: data.season || undefined,
    collection: data.collection || undefined,
    productUrl: data.productUrl || undefined,
    visibility: data.visibility || "visible",
    source: data.source || undefined,
    type: data.type,
    topCategory: data.topCategory,
    subCategory: data.subCategory,
    sizes: parseSizesCsv(data.sizes),
    tags: parseTagsCsv(data.tags),
    imageUrl: data.imageUrl,
    sizeGuideTemplateId: data.sizeGuideTemplateId,
    sizeGuide: {
      imageUrl: data.sizeGuideImageUrl || undefined,
      entries: data.sizeGuideRows || [],
      details: data.sizeGuideText ? parseLinesCsv(data.sizeGuideText) : undefined,
    },
    deliveriesReturnsTemplateId: data.deliveriesReturnsTemplateId,
    deliveriesReturns: {
      deliveryTime: data.deliveryTime || "",
      returnPolicy: data.returnPolicy || "",
      refundConditions: data.refundConditions || "",
    },
    shippingDeliveryTemplateId: data.shippingDeliveryTemplateId,
    shippingDelivery: {
      regions: data.shippingRegions ? parseLinesCsv(data.shippingRegions) : [],
      estimatedDeliveryTime: data.shippingEstimatedDeliveryTime || "",
      charges: data.shippingCharges,
    },
    fabricCareTemplateId: data.fabricCareTemplateId,
    fabricCare: {
      fabricType: data.fabricType || data.fabricComposition || "",
      careInstructions: data.careInstructions ? parseLinesCsv(data.careInstructions) : data.careGuide ? parseLinesCsv(data.careGuide) : [],
    },
    detail: cleanBlock({
      fabricComposition: data.fabricComposition,
      careGuide: data.careGuide,
      fitDetails: data.fitDetails || data.fit,
      modelDetails: data.modelDetails,
      sizeGuideText: data.sizeGuideText,
      sizeGuideImageUrl,
      shippingDelivery: data.shippingDeliveryText || data.deliveryText,
      returnExchangePolicy: data.returnExchangePolicy,
      disclaimer: data.disclaimer,
      materialDetails: data.materialDetails,
      origin: data.origin,
      packageIncludes: data.packageIncludes,
    }),
    shipping: cleanBlock({
      estimatedDeliveryMinDays: optionalNumber(data.estimatedDeliveryMinDays),
      estimatedDeliveryMaxDays: optionalNumber(data.estimatedDeliveryMaxDays),
      deliveryText: data.deliveryText,
      shippingFee: optionalNumber(data.shippingFee),
      freeShippingAvailable: data.freeShippingAvailable,
      codAvailable: data.codAvailable,
      returnAvailable: data.returnAvailable,
      exchangeAvailable: data.exchangeAvailable,
      returnWindowDays: optionalNumber(data.returnWindowDays),
      exchangeWindowDays: optionalNumber(data.exchangeWindowDays),
    }),
    seo: cleanBlock({
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      canonicalUrl: data.canonicalUrl,
      ogImageUrl: data.ogImageUrl,
    }),
    stock: data.stock,
    isActive: data.isActive,
  };
}

export function buildAdminProductPayload(form: ProductFormValues): ProductMutationPayload {
  const parsed = adminProductFormSchema.safeParse(form);

  if (!parsed.success) {
    throw new Error(formatValidationIssues(parsed.error));
  }

  return {
    brandId: parsed.data.brandId,
    ...buildProductPayloadFromParsed(parsed.data),
  };
}

export function buildBrandProductPayload(
  form: Omit<ProductFormValues, "brandId">,
): Omit<ProductMutationPayload, "brandId"> {
  const parsed = productFormSchema.omit({ brandId: true }).safeParse(form);

  if (!parsed.success) {
    throw new Error(formatValidationIssues(parsed.error));
  }

  return buildProductPayloadFromParsed(parsed.data);
}

export function createDefaultProductFormValues(scope: "admin" | "brand", brandId?: string): ProductFormValues {
  return {
    brandId: scope === "admin" ? brandId : undefined,
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    actualPrice: "",
    salePrice: "",
    discountPercentage: "",
    pricePkr: "",
    currency: "PKR",
    label: "",
    saleStartDate: "",
    saleEndDate: "",
    gender: "Women",
    color: "",
    fit: "",
    season: "",
    collection: "",
    productUrl: "",
    visibility: "visible",
    source: scope === "admin" ? "manual" : "brand_upload",
    type: "Top",
    topCategory: "Men",
    subCategory: "",
    sizes: "",
    tags: "",
    imageUrl: "",
    sizeGuideImageUrl: undefined,
    sizeGuideRows: [{ size: "", cm: "", inches: "" }],
    deliveryTime: "",
    returnPolicy: "",
    refundConditions: "",
    shippingRegions: "",
    shippingEstimatedDeliveryTime: "",
    shippingCharges: undefined,
    fabricType: "",
    careInstructions: "",
    fabricComposition: "",
    careGuide: "",
    fitDetails: "",
    modelDetails: "",
    sizeGuideText: "",
    detailSizeGuideImageUrl: "",
    shippingDeliveryText: "",
    returnExchangePolicy: "",
    disclaimer: "",
    materialDetails: "",
    origin: "",
    packageIncludes: "",
    estimatedDeliveryMinDays: "",
    estimatedDeliveryMaxDays: "",
    deliveryText: "",
    shippingFee: "",
    freeShippingAvailable: false,
    codAvailable: true,
    returnAvailable: true,
    exchangeAvailable: true,
    returnWindowDays: "",
    exchangeWindowDays: "",
    metaTitle: "",
    metaDescription: "",
    canonicalUrl: "",
    ogImageUrl: "",
    stock: "",
  };
}

function normalizeGenderValue(value: string | undefined): Product["gender"] {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "men" || normalized === "man" || normalized === "male") return "Men";
  if (normalized === "women" || normalized === "woman" || normalized === "female") return "Women";
  if (normalized === "juniors" || normalized === "kids") return "Juniors";
  return "Women";
}

export function productToFormValues(product: Partial<Product>): Partial<ProductFormValues> {
  return {
    brandId: product.brandId,
    name: product.name || "",
    slug: product.slug || "",
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    actualPrice: product.actualPrice ? String(product.actualPrice) : "",
    salePrice: product.salePrice ? String(product.salePrice) : "",
    discountPercentage: product.discountPercentage ? String(product.discountPercentage) : "",
    pricePkr: product.pricePkr ? String(product.pricePkr) : "",
    currency: product.currency || "PKR",
    label: product.label || "",
    saleStartDate: product.saleStartDate ? String(product.saleStartDate).slice(0, 10) : "",
    saleEndDate: product.saleEndDate ? String(product.saleEndDate).slice(0, 10) : "",
    gender: normalizeGenderValue(product.gender),
    color: product.color || "",
    fit: product.fit || "",
    season: product.season || "",
    collection: product.collection || "",
    productUrl: product.productUrl || "",
    visibility: (product.visibility as ProductFormValues["visibility"]) || "visible",
    source: product.source || "",
    type: product.productType || "Top",
    topCategory: product.topCategory || "Men",
    subCategory: product.subCategory || "",
    sizes: product.sizes ? product.sizes.join(", ") : "",
    tags: product.tags ? product.tags.join(", ") : "",
    imageUrl: product.imageUrl || "",
    sizeGuideTemplateId: product.sizeGuideTemplateId,
    sizeGuideImageUrl: product.sizeGuide?.imageUrl,
    sizeGuideRows: product.sizeGuide?.entries || [{ size: "", cm: "", inches: "" }],
    deliveriesReturnsTemplateId: product.deliveriesReturnsTemplateId,
    deliveryTime: product.deliveriesReturns?.deliveryTime || "",
    returnPolicy: product.deliveriesReturns?.returnPolicy || "",
    refundConditions: product.deliveriesReturns?.refundConditions || "",
    shippingDeliveryTemplateId: product.shippingDeliveryTemplateId,
    shippingRegions: product.shippingDelivery?.regions?.join("\n") || "",
    shippingEstimatedDeliveryTime: product.shippingDelivery?.estimatedDeliveryTime || "",
    shippingCharges: product.shippingDelivery?.charges,
    fabricCareTemplateId: product.fabricCareTemplateId,
    fabricType: product.fabricCare?.fabricType || "",
    careInstructions: product.fabricCare?.careInstructions?.join("\n") || "",
    fabricComposition: product.detail?.fabricComposition || product.fabricCare?.fabricType || "",
    careGuide: product.detail?.careGuide || product.fabricCare?.careInstructions?.join("\n") || "",
    fitDetails: product.detail?.fitDetails || product.fit || "",
    modelDetails: product.detail?.modelDetails || "",
    sizeGuideText: product.detail?.sizeGuideText || product.sizeGuide?.details?.join("\n") || "",
    detailSizeGuideImageUrl: product.detail?.sizeGuideImageUrl || product.sizeGuide?.imageUrl || "",
    shippingDeliveryText: product.detail?.shippingDelivery || "",
    returnExchangePolicy: product.detail?.returnExchangePolicy || "",
    disclaimer: product.detail?.disclaimer || "",
    materialDetails: product.detail?.materialDetails || "",
    origin: product.detail?.origin || "",
    packageIncludes: product.detail?.packageIncludes || "",
    estimatedDeliveryMinDays: product.shipping?.estimatedDeliveryMinDays != null ? String(product.shipping.estimatedDeliveryMinDays) : "",
    estimatedDeliveryMaxDays: product.shipping?.estimatedDeliveryMaxDays != null ? String(product.shipping.estimatedDeliveryMaxDays) : "",
    deliveryText: product.shipping?.deliveryText || "",
    shippingFee: product.shipping?.shippingFee != null ? String(product.shipping.shippingFee) : "",
    freeShippingAvailable: Boolean(product.shipping?.freeShippingAvailable),
    codAvailable: product.shipping?.codAvailable ?? true,
    returnAvailable: product.shipping?.returnAvailable ?? true,
    exchangeAvailable: product.shipping?.exchangeAvailable ?? true,
    returnWindowDays: product.shipping?.returnWindowDays != null ? String(product.shipping.returnWindowDays) : "",
    exchangeWindowDays: product.shipping?.exchangeWindowDays != null ? String(product.shipping.exchangeWindowDays) : "",
    metaTitle: product.seo?.metaTitle || "",
    metaDescription: product.seo?.metaDescription || "",
    canonicalUrl: product.seo?.canonicalUrl || "",
    ogImageUrl: product.seo?.ogImageUrl || "",
    stock: product.stock ? String(product.stock) : "",
    isActive: product.isActive,
  };
}
