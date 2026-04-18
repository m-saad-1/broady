import { z } from "zod";

export const productTopCategories = ["Men", "Women", "Kids"] as const;
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
    .min(1),
});

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

export const productBaseSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim().min(10),
  pricePkr: z.coerce.number().int().positive(),
  topCategory: z.enum(productTopCategories),
  subCategory: z.string().trim().min(2),
  sizes: z.array(z.string().trim().min(1)).min(1),
  imageUrl: productImageUrlSchema,
  sizeGuideTemplateId: optionalTemplateIdSchema,
  sizeGuide: productSizeGuideSchema,
  deliveriesReturnsTemplateId: optionalTemplateIdSchema,
  deliveriesReturns: productDeliveriesReturnsSchema,
  shippingDeliveryTemplateId: optionalTemplateIdSchema,
  shippingDelivery: productShippingDeliverySchema,
  fabricCareTemplateId: optionalTemplateIdSchema,
  fabricCare: productFabricCareSchema,
  stock: z.coerce.number().int().min(0),
  isActive: z.boolean().optional(),
});
