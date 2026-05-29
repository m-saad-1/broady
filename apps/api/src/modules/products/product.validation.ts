import { z } from "zod";

export const productTopCategories = ["Men", "Women", "Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"] as const;
export const productApprovalStatuses = ["DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;
export const productTemplateTypes = ["SIZE_GUIDE", "DELIVERIES_RETURNS", "SHIPPING_DELIVERY", "FABRIC_CARE"] as const;

function isProductAssetUrl(value: string) {
  if (value.startsWith("/")) return true;

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export const productImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isProductAssetUrl, {
    message: "Image URL must be an absolute http(s) URL or a root-relative asset path",
  });

const optionalTemplateIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalPositiveNumberSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().positive().optional(),
);

const optionalPercentageSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().min(0).max(100).optional(),
);

export const productSizeGuideSchema = z.object({
  imageUrl: productImageUrlSchema.optional(),
  entries: z
    .array(
      z.object({
        size: z.string().trim().min(1),
        cm: z.string().trim().min(1),
        inches: z.string().trim().min(1),
      }),
    )
    .optional(),
  details: z.array(z.string().trim().min(1)).optional(),
}).refine(
  (value) => Boolean(value.imageUrl) || Boolean(value.entries?.length) || Boolean(value.details?.length),
  { message: "Size guide requires at least an image, entries, or details." },
);

export const productDeliveriesReturnsSchema = z.object({
  deliveryTime: z.string().trim().min(2),
  returnPolicy: z.string().trim().min(2),
  refundConditions: z.string().trim().min(2),
});

export const productShippingDeliverySchema = z.object({
  regions: z.array(z.string().trim().min(1)).min(1),
  estimatedDeliveryTime: z.string().trim().min(2),
  charges: z.string().trim().optional(),
});

export const productFabricCareSchema = z.object({
  fabricType: z.string().trim().min(2),
  careInstructions: z.array(z.string().trim().min(1)).min(1),
});

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length ? value : undefined));

const optionalAssetUrlSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || isProductAssetUrl(value), {
    message: "URL must be an absolute http(s) URL or a root-relative asset path",
  });

const productDetailSchema = z.object({
  fabricComposition: optionalTextSchema,
  careGuide: optionalTextSchema,
  fitDetails: optionalTextSchema,
  modelDetails: optionalTextSchema,
  sizeGuideText: optionalTextSchema,
  sizeGuideImageUrl: optionalAssetUrlSchema,
  shippingDelivery: optionalTextSchema,
  returnExchangePolicy: optionalTextSchema,
  disclaimer: optionalTextSchema,
  materialDetails: optionalTextSchema,
  origin: optionalTextSchema,
  packageIncludes: optionalTextSchema,
}).partial();

const productShippingSchema = z.object({
  estimatedDeliveryMinDays: z.coerce.number().int().nonnegative().optional(),
  estimatedDeliveryMaxDays: z.coerce.number().int().nonnegative().optional(),
  deliveryText: optionalTextSchema,
  shippingFee: z.coerce.number().int().nonnegative().optional(),
  freeShippingAvailable: z.boolean().optional(),
  codAvailable: z.boolean().optional(),
  returnAvailable: z.boolean().optional(),
  exchangeAvailable: z.boolean().optional(),
  returnWindowDays: z.coerce.number().int().nonnegative().optional(),
  exchangeWindowDays: z.coerce.number().int().nonnegative().optional(),
}).partial();

const productSeoSchema = z.object({
  metaTitle: optionalTextSchema,
  metaDescription: optionalTextSchema,
  canonicalUrl: optionalTextSchema,
  ogImageUrl: optionalAssetUrlSchema,
}).partial();

export const productBaseSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  shortDescription: optionalTextSchema,
  description: z.string().trim().min(10),
  actualPrice: z.coerce.number().positive(),
  salePrice: optionalPositiveNumberSchema,
  discountPercentage: optionalPercentageSchema,
  pricePkr: z.coerce.number().int().positive(),
  currency: z.string().trim().min(2).default("PKR").optional(),
  label: optionalTextSchema,
  saleStartDate: z.coerce.date().optional(),
  saleEndDate: z.coerce.date().optional(),
  gender: z.enum(["Men", "Women", "Juniors"]),
  color: z.string().trim().min(2),
  type: z.enum(["Top", "Bottom", "Footwear", "Accessories"]),
  fit: optionalTextSchema,
  season: optionalTextSchema,
  collection: optionalTextSchema,
  productUrl: optionalTextSchema,
  visibility: z.enum(["visible", "hidden"]).optional(),
  source: optionalTextSchema,
  topCategory: z.enum(productTopCategories),
  subCategory: z.string().trim().min(2),
  sizes: z.array(z.string().trim().min(1)).min(1),
  tags: z.array(z.string().trim().min(1)).optional(),
  imageUrl: productImageUrlSchema,
  sizeGuideTemplateId: optionalTemplateIdSchema,
  sizeGuide: productSizeGuideSchema.optional(),
  deliveriesReturnsTemplateId: optionalTemplateIdSchema,
  deliveriesReturns: productDeliveriesReturnsSchema.optional(),
  shippingDeliveryTemplateId: optionalTemplateIdSchema,
  shippingDelivery: productShippingDeliverySchema.optional(),
  fabricCareTemplateId: optionalTemplateIdSchema,
  fabricCare: productFabricCareSchema.optional(),
  detail: productDetailSchema.optional(),
  shipping: productShippingSchema.optional(),
  seo: productSeoSchema.optional(),
  stock: z.coerce.number().int().min(0),
  isActive: z.boolean().optional(),
});
