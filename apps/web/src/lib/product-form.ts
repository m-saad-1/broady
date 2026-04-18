import { z } from "zod";
import type { ProductMutationPayload } from "@/lib/api";
import type { Product } from "@/types/marketplace";

export type ProductFormValues = {
  brandId?: string;
  name: string;
  slug: string;
  description: string;
  pricePkr: string;
  topCategory: Product["topCategory"];
  subCategory: string;
  sizes: string;
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
  stock: string;
  isActive?: boolean;
};

const productTopCategories = ["Men", "Women", "Kids"] as const;

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

function parseLinesCsv(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

const productFormSchema = z.object({
  brandId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  pricePkr: z.coerce.number().int().positive("Price must be greater than 0"),
  topCategory: z.enum(productTopCategories),
  subCategory: z.string().trim().min(2, "Sub-category must be at least 2 characters"),
  sizes: z.string().trim().min(1, "Add at least one size"),
  imageUrl: z
    .string()
    .trim()
    .min(1, "Image URL is required")
    .refine(isProductAssetUrl, {
      message: "Image URL must be an absolute http(s) URL or a root-relative asset path",
    }),
  sizeGuideTemplateId: z.string().trim().min(1).optional(),
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
    .min(1, "Add at least one size guide row"),
  deliveriesReturnsTemplateId: z.string().trim().min(1).optional(),
  deliveryTime: z.string().trim().min(2, "Delivery time is required"),
  returnPolicy: z.string().trim().min(2, "Return policy is required"),
  refundConditions: z.string().trim().min(2, "Refund conditions are required"),
  shippingDeliveryTemplateId: z.string().trim().min(1).optional(),
  shippingRegions: z.string().trim().min(2, "Shipping regions are required"),
  shippingEstimatedDeliveryTime: z.string().trim().min(2, "Estimated delivery time is required"),
  shippingCharges: z.string().trim().optional(),
  fabricCareTemplateId: z.string().trim().min(1).optional(),
  fabricType: z.string().trim().min(2, "Fabric type is required"),
  careInstructions: z.string().trim().min(2, "Care instructions are required"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  isActive: z.boolean().optional(),
});

const adminProductFormSchema = productFormSchema.extend({
  brandId: z.string().trim().min(1, "Select a brand"),
});

export function buildAdminProductPayload(form: ProductFormValues): ProductMutationPayload {
  const parsed = adminProductFormSchema.safeParse({
    brandId: form.brandId,
    name: form.name,
    slug: form.slug,
    description: form.description,
    pricePkr: form.pricePkr,
    topCategory: form.topCategory,
    subCategory: form.subCategory,
    sizes: form.sizes,
    imageUrl: form.imageUrl,
    sizeGuideTemplateId: form.sizeGuideTemplateId,
    sizeGuideImageUrl: form.sizeGuideImageUrl,
    sizeGuideRows: form.sizeGuideRows,
    deliveriesReturnsTemplateId: form.deliveriesReturnsTemplateId,
    deliveryTime: form.deliveryTime,
    returnPolicy: form.returnPolicy,
    refundConditions: form.refundConditions,
    shippingDeliveryTemplateId: form.shippingDeliveryTemplateId,
    shippingRegions: form.shippingRegions,
    shippingEstimatedDeliveryTime: form.shippingEstimatedDeliveryTime,
    shippingCharges: form.shippingCharges,
    fabricCareTemplateId: form.fabricCareTemplateId,
    fabricType: form.fabricType,
    careInstructions: form.careInstructions,
    stock: form.stock,
    isActive: form.isActive,
  });

  if (!parsed.success) {
    throw new Error(formatValidationIssues(parsed.error));
  }

  return {
    brandId: parsed.data.brandId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    pricePkr: parsed.data.pricePkr,
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
    sizes: parseSizesCsv(parsed.data.sizes),
    imageUrl: parsed.data.imageUrl,
    sizeGuideTemplateId: parsed.data.sizeGuideTemplateId,
    sizeGuide: {
      imageUrl: parsed.data.sizeGuideImageUrl,
      entries: parsed.data.sizeGuideRows,
    },
    deliveriesReturnsTemplateId: parsed.data.deliveriesReturnsTemplateId,
    deliveriesReturns: {
      deliveryTime: parsed.data.deliveryTime,
      returnPolicy: parsed.data.returnPolicy,
      refundConditions: parsed.data.refundConditions,
    },
    shippingDeliveryTemplateId: parsed.data.shippingDeliveryTemplateId,
    shippingDelivery: {
      regions: parseLinesCsv(parsed.data.shippingRegions),
      estimatedDeliveryTime: parsed.data.shippingEstimatedDeliveryTime,
      charges: parsed.data.shippingCharges,
    },
    fabricCareTemplateId: parsed.data.fabricCareTemplateId,
    fabricCare: {
      fabricType: parsed.data.fabricType,
      careInstructions: parseLinesCsv(parsed.data.careInstructions),
    },
    stock: parsed.data.stock,
    isActive: parsed.data.isActive,
  };
}

export function buildBrandProductPayload(
  form: Omit<ProductFormValues, "brandId">,
): Omit<ProductMutationPayload, "brandId"> {
  const parsed = productFormSchema.omit({ brandId: true }).safeParse({
    name: form.name,
    slug: form.slug,
    description: form.description,
    pricePkr: form.pricePkr,
    topCategory: form.topCategory,
    subCategory: form.subCategory,
    sizes: form.sizes,
    imageUrl: form.imageUrl,
    sizeGuideTemplateId: form.sizeGuideTemplateId,
    sizeGuideImageUrl: form.sizeGuideImageUrl,
    sizeGuideRows: form.sizeGuideRows,
    deliveriesReturnsTemplateId: form.deliveriesReturnsTemplateId,
    deliveryTime: form.deliveryTime,
    returnPolicy: form.returnPolicy,
    refundConditions: form.refundConditions,
    shippingDeliveryTemplateId: form.shippingDeliveryTemplateId,
    shippingRegions: form.shippingRegions,
    shippingEstimatedDeliveryTime: form.shippingEstimatedDeliveryTime,
    shippingCharges: form.shippingCharges,
    fabricCareTemplateId: form.fabricCareTemplateId,
    fabricType: form.fabricType,
    careInstructions: form.careInstructions,
    stock: form.stock,
    isActive: form.isActive,
  });

  if (!parsed.success) {
    throw new Error(formatValidationIssues(parsed.error));
  }

  return {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    pricePkr: parsed.data.pricePkr,
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
    sizes: parseSizesCsv(parsed.data.sizes),
    imageUrl: parsed.data.imageUrl,
    sizeGuideTemplateId: parsed.data.sizeGuideTemplateId,
    sizeGuide: {
      imageUrl: parsed.data.sizeGuideImageUrl,
      entries: parsed.data.sizeGuideRows,
    },
    deliveriesReturnsTemplateId: parsed.data.deliveriesReturnsTemplateId,
    deliveriesReturns: {
      deliveryTime: parsed.data.deliveryTime,
      returnPolicy: parsed.data.returnPolicy,
      refundConditions: parsed.data.refundConditions,
    },
    shippingDeliveryTemplateId: parsed.data.shippingDeliveryTemplateId,
    shippingDelivery: {
      regions: parseLinesCsv(parsed.data.shippingRegions),
      estimatedDeliveryTime: parsed.data.shippingEstimatedDeliveryTime,
      charges: parsed.data.shippingCharges,
    },
    fabricCareTemplateId: parsed.data.fabricCareTemplateId,
    fabricCare: {
      fabricType: parsed.data.fabricType,
      careInstructions: parseLinesCsv(parsed.data.careInstructions),
    },
    stock: parsed.data.stock,
    isActive: parsed.data.isActive,
  };
}
