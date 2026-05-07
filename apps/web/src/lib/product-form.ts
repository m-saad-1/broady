import { z } from "zod";
import type { ProductMutationPayload } from "@/lib/api";
import type { Product } from "@/types/marketplace";

export type ProductFormValues = {
  brandId?: string;
  name: string;
  slug: string;
  description: string;
  actualPrice: string;
  salePrice?: string;
  discountPercentage?: string;
  pricePkr: string;
  gender: string;
  color: string;
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

function parseLinesCsv(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

const optionalTemplateIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const productFormSchema = z.object({
  brandId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  actualPrice: z.coerce.number().positive("Actual price must be greater than 0"),
  salePrice: z.coerce.number().positive("Sale price must be greater than 0").optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  pricePkr: z.coerce.number().int().positive("Price must be greater than 0"),
  gender: z.string().trim().min(2, "Gender is required"),
  color: z.string().trim().min(2, "Color is required"),
  type: z.string().trim().min(2, "Type is required"),
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
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  isActive: z.boolean().optional(),
});

const adminProductFormSchema = productFormSchema.extend({
  brandId: z.string().trim().min(1, "Select a brand"),
});

export { productFormSchema, adminProductFormSchema };

export function buildAdminProductPayload(form: ProductFormValues): ProductMutationPayload {
  const parsed = adminProductFormSchema.safeParse(form);

  if (!parsed.success) {
    throw new Error(formatValidationIssues(parsed.error));
  }

    const { sizes, shippingRegions, careInstructions, ...rest } = parsed.data;

  return {
    ...rest,
    sizes: parseSizesCsv(sizes),
    sizeGuide: {
      imageUrl: parsed.data.sizeGuideImageUrl,
      entries: parsed.data.sizeGuideRows || [],
    },
    deliveriesReturns: {
      deliveryTime: parsed.data.deliveryTime || "",
      returnPolicy: parsed.data.returnPolicy || "",
      refundConditions: parsed.data.refundConditions || "",
    },
    shippingDelivery: {
      regions: shippingRegions ? parseLinesCsv(shippingRegions) : [],
      estimatedDeliveryTime: parsed.data.shippingEstimatedDeliveryTime || "",
      charges: parsed.data.shippingCharges,
    },
    fabricCare: {
      fabricType: parsed.data.fabricType || "",
      careInstructions: careInstructions ? parseLinesCsv(careInstructions) : [],
    },
  };
}

export function buildBrandProductPayload(
  form: Omit<ProductFormValues, "brandId">,
): Omit<ProductMutationPayload, "brandId"> {
  const parsed = productFormSchema.omit({ brandId: true }).safeParse(form);

  if (!parsed.success) {
    throw new Error(formatValidationIssues(parsed.error));
  }

  const { sizes, shippingRegions, careInstructions, ...rest } = parsed.data;

  return {
    ...rest,
    sizes: parseSizesCsv(sizes),
    sizeGuide: {
      imageUrl: parsed.data.sizeGuideImageUrl,
      entries: parsed.data.sizeGuideRows || [],
    },
    deliveriesReturns: {
      deliveryTime: parsed.data.deliveryTime || "",
      returnPolicy: parsed.data.returnPolicy || "",
      refundConditions: parsed.data.refundConditions || "",
    },
    shippingDelivery: {
      regions: shippingRegions ? parseLinesCsv(shippingRegions) : [],
      estimatedDeliveryTime: parsed.data.shippingEstimatedDeliveryTime || "",
      charges: parsed.data.shippingCharges,
    },
    fabricCare: {
      fabricType: parsed.data.fabricType || "",
      careInstructions: careInstructions ? parseLinesCsv(careInstructions) : [],
    },
  };
}

export function createDefaultProductFormValues(scope: "admin" | "brand", brandId?: string): ProductFormValues {
  return {
    brandId: scope === "admin" ? brandId : undefined,
    name: "",
    slug: "",
    description: "",
    actualPrice: "",
    salePrice: "",
    discountPercentage: "",
    pricePkr: "",
    gender: "WOMEN",
    color: "",
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
    stock: "",
  };
}

export function productToFormValues(product: Partial<Product>): Partial<ProductFormValues> {
  return {
    brandId: product.brandId,
    name: product.name || "",
    slug: product.slug || "",
    description: product.description || "",
    actualPrice: product.actualPrice ? String(product.actualPrice) : "",
    salePrice: product.salePrice ? String(product.salePrice) : "",
    discountPercentage: product.discountPercentage ? String(product.discountPercentage) : "",
    pricePkr: product.pricePkr ? String(product.pricePkr) : "",
    gender: product.gender || "WOMEN",
    color: product.color || "",
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
    stock: product.stock ? String(product.stock) : "",
    isActive: product.isActive,
  };
}
