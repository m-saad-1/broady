import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { productBaseSchema } from "./product.validation.js";
import {
  correctSearchInput,
  normalizeSearchInput,
  expandCatalogTopCategory,
  tokenizeSearchQuery,
} from "./products.search-utils.js";
import {
  isMeilisearchProductSearchEnabled,
  runMeilisearchProductSearch,
} from "./products.meilisearch-search.js";
import { z } from "zod";

type ProductCreateData = z.infer<typeof productBaseSchema>;

export const productStructureInclude = {
  brand: true,
  detail: true,
  shipping: true,
  seo: true,
  variants: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
  images: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
} satisfies Prisma.ProductInclude;

function hasBlockData(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((entry) => entry !== undefined && entry !== null && String(entry).trim() !== "");
}

function normalizePricing(data: Partial<ProductCreateData>, currentActualPrice?: number) {
  const actualPrice = data.actualPrice ?? currentActualPrice ?? 0;
  const explicitSalePrice = data.salePrice;
  const discountPercentage = data.discountPercentage && data.discountPercentage > 0 ? data.discountPercentage : undefined;
  const discountedFromPercentage = discountPercentage ? actualPrice - (actualPrice * discountPercentage) / 100 : undefined;
  const salePrice = discountedFromPercentage ?? (explicitSalePrice && explicitSalePrice < actualPrice ? explicitSalePrice : undefined);
  const finalPrice = Math.round(salePrice ?? actualPrice);
  const resolvedDiscount =
    salePrice && salePrice < actualPrice ? Math.max(0, Math.round(((actualPrice - salePrice) / actualPrice) * 100)) : undefined;

  return {
    actualPrice,
    salePrice,
    discountPercentage: resolvedDiscount,
    pricePkr: finalPrice,
  };
}

function splitStructuredProductPayload<T extends Partial<ProductCreateData>>(data: T) {
  const { detail, shipping, seo, ...productData } = data;
  return { detail, shipping, seo, productData };
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function tokenVariants(token: string) {
  const upper = token.toUpperCase();
  const title = toTitleCase(token);
  return Array.from(new Set([token, upper, title]));
}

function containsToken(field: string, token: string) {
  return { [field]: { contains: token, mode: "insensitive" } };
}

function buildSearchTokenCondition(token: string) {
  const variants = tokenVariants(token);

  return {
    OR: [
      containsToken("name", token),
      containsToken("slug", token),
      containsToken("shortDescription", token),
      containsToken("description", token),
      containsToken("searchDocument", token),
      containsToken("gender", token),
      containsToken("type", token),
      containsToken("color", token),
      containsToken("fit", token),
      containsToken("season", token),
      containsToken("collection", token),
      containsToken("label", token),
      containsToken("topCategory", token),
      containsToken("subCategory", token),
      { tags: { hasSome: variants } },
      { sizes: { hasSome: variants } },
      {
        brand: {
          is: {
            OR: [
              { name: { contains: token, mode: "insensitive" } },
              { slug: { contains: token, mode: "insensitive" } },
              { description: { contains: token, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        variants: {
          some: {
            deletedAt: null,
            OR: [
              { sku: { contains: token, mode: "insensitive" } },
              { barcode: { contains: token, mode: "insensitive" } },
              { color: { contains: token, mode: "insensitive" } },
              { size: { in: variants } },
              { fit: { contains: token, mode: "insensitive" } },
              { season: { contains: token, mode: "insensitive" } },
              { style: { contains: token, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        detail: {
          is: {
            OR: [
              { fabricComposition: { contains: token, mode: "insensitive" } },
              { careGuide: { contains: token, mode: "insensitive" } },
              { fitDetails: { contains: token, mode: "insensitive" } },
              { modelDetails: { contains: token, mode: "insensitive" } },
              { sizeGuideText: { contains: token, mode: "insensitive" } },
              { shippingDelivery: { contains: token, mode: "insensitive" } },
              { returnExchangePolicy: { contains: token, mode: "insensitive" } },
              { disclaimer: { contains: token, mode: "insensitive" } },
              { materialDetails: { contains: token, mode: "insensitive" } },
              { origin: { contains: token, mode: "insensitive" } },
              { packageIncludes: { contains: token, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        seo: {
          is: {
            OR: [
              { metaTitle: { contains: token, mode: "insensitive" } },
              { metaDescription: { contains: token, mode: "insensitive" } },
              { canonicalUrl: { contains: token, mode: "insensitive" } },
            ],
          },
        },
      },
    ],
  };
}

async function syncStructuredProductBlocks(productId: string, data: Partial<ProductCreateData>) {
  const { detail, shipping, seo } = data;
  const operations: Array<Promise<unknown>> = [];

  if (detail !== undefined) {
    operations.push(
      hasBlockData(detail)
        ? prisma.productDetail.upsert({
            where: { productId },
            create: { productId, ...(detail as any) },
            update: detail as any,
          })
        : prisma.productDetail.deleteMany({ where: { productId } }),
    );
  }

  if (shipping !== undefined) {
    operations.push(
      hasBlockData(shipping)
        ? prisma.productShipping.upsert({
            where: { productId },
            create: { productId, ...(shipping as any) },
            update: shipping as any,
          })
        : prisma.productShipping.deleteMany({ where: { productId } }),
    );
  }

  if (seo !== undefined) {
    operations.push(
      hasBlockData(seo)
        ? prisma.productSEO.upsert({
            where: { productId },
            create: { productId, ...(seo as any) },
            update: seo as any,
          })
        : prisma.productSEO.deleteMany({ where: { productId } }),
    );
  }

  await Promise.all(operations);
}

export async function createProduct(
  data: ProductCreateData,
  brandId: string,
  options?: { approvalStatus?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"; isActive?: boolean; source?: string },
) {
  const validation = productBaseSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Invalid product data: ${validation.error.message}`);
  }

  const { productData, detail, shipping, seo } = splitStructuredProductPayload(validation.data);
  const pricing = normalizePricing(validation.data);

  const product = await prisma.product.create({
    data: {
    ...productData,
    brandId,
    ...pricing,
    currency: productData.currency || "PKR",
    visibility: productData.visibility || "visible",
    source: options?.source || productData.source || "manual",
    approvalStatus: options?.approvalStatus || "APPROVED",
    isActive: options?.isActive ?? productData.isActive ?? true,
    },
  });

  await syncStructuredProductBlocks(product.id, { detail, shipping, seo } as Partial<ProductCreateData>);

  return prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    include: productStructureInclude,
  });
}

export async function getProductById(id: string) {
  return prisma.product.findFirst({
    where: {
      id,
      approvalStatus: "APPROVED",
      isActive: true,
      deletedAt: null,
    },
    include: productStructureInclude,
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      approvalStatus: "APPROVED",
      isActive: true,
      deletedAt: null,
    },
    include: productStructureInclude,
  });
}

export async function updateProduct(id: string, data: Partial<ProductCreateData>) {
    const validation = productBaseSchema.partial().safeParse(data);
    if (!validation.success) {
        throw new Error(`Invalid product data: ${validation.error.message}`);
    }

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
        throw new Error("Product not found");
    }
    
    const { productData, detail, shipping, seo } = splitStructuredProductPayload(validation.data);
    const shouldReprice =
      validation.data.actualPrice !== undefined ||
      validation.data.salePrice !== undefined ||
      validation.data.discountPercentage !== undefined;
    const pricing = shouldReprice ? normalizePricing(validation.data, existingProduct.actualPrice) : {};

    await prisma.product.update({
        where: { id },
        data: {
          ...productData,
          ...pricing,
        },
    });

    await syncStructuredProductBlocks(id, { detail, shipping, seo } as Partial<ProductCreateData>);

    return prisma.product.findUniqueOrThrow({
      where: { id },
      include: productStructureInclude,
    });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({
    where: { id },
  });
}

export async function listProducts(options: Record<string, any>) {
  const {
    brandId,
    topCategory,
    juniorCategory,
    gender,
    productType,
    subCategory,
    size,
    color,
    minPrice,
    maxPrice,
    sort = "latest",
    query,
    q,
    page = 1,
    limit = 100,
  } = options;

  const rawQuery = typeof q === "string" && q.trim() ? q : typeof query === "string" ? query : "";
  const normalizedInput = normalizeSearchInput(rawQuery);
  const correctedInput = correctSearchInput(normalizedInput) || normalizedInput;

  const resolvedTopCategory = typeof topCategory === "string" && topCategory ? topCategory : undefined;
  const resolvedJuniorCategory = typeof juniorCategory === "string" && juniorCategory ? juniorCategory : undefined;
  const resolvedGender =
    typeof gender === "string" && gender
      ? gender
      : resolvedTopCategory === "Juniors" ||
          ["Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"].includes(resolvedTopCategory || "")
        ? "Juniors"
        : resolvedTopCategory;

  const effectiveJuniorCategory =
    resolvedJuniorCategory ||
    (["Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"].includes(resolvedTopCategory || "")
      ? resolvedTopCategory
      : undefined);
  const effectiveType = typeof productType === "string" && productType ? productType : undefined;
  const effectiveSubCategory = typeof subCategory === "string" && subCategory ? subCategory : undefined;
  const effectiveSize = typeof size === "string" && size ? size : undefined;
  const effectiveColor = typeof color === "string" && color ? color : undefined;

  const minPriceValue = typeof minPrice === "string" ? Number(minPrice) : minPrice;
  const maxPriceValue = typeof maxPrice === "string" ? Number(maxPrice) : maxPrice;

  const hasAnyFilters =
    Boolean(resolvedGender) ||
    Boolean(effectiveJuniorCategory) ||
    Boolean(effectiveType) ||
    Boolean(effectiveSubCategory) ||
    Boolean(effectiveSize) ||
    Boolean(effectiveColor) ||
    Boolean(minPriceValue || maxPriceValue);
  const effectiveQuery = correctedInput;
  const effectiveSearchTokens = tokenizeSearchQuery(effectiveQuery);
  const isShortQuery = correctedInput.trim().length > 0 && correctedInput.trim().length < 2 && !hasAnyFilters;
  const pageValue = Math.max(Number(page) || 1, 1);
  const limitValue = Math.min(Math.max(Number(limit) || 100, 1), 5000);
  const skipValue = (pageValue - 1) * limitValue;
  const takeValue = limitValue;

  if (isShortQuery && !hasAnyFilters) {
    return [];
  }

  if (isMeilisearchProductSearchEnabled()) {
    const ids = await runMeilisearchProductSearch(effectiveQuery, {
      brandId,
      gender: resolvedGender,
      topCategory: resolvedTopCategory,
      juniorCategory: effectiveJuniorCategory || undefined,
      productType: effectiveType,
      subCategory: effectiveSubCategory,
      size: effectiveSize,
      color: effectiveColor,
      minPrice: Number.isFinite(minPriceValue) ? minPriceValue : undefined,
      maxPrice: Number.isFinite(maxPriceValue) ? maxPriceValue : undefined,
      limit: skipValue + takeValue,
    });

    if (!ids.length) {
      return [];
    }

    const items = await prisma.product.findMany({
      where: {
        id: { in: ids },
        approvalStatus: "APPROVED",
        isActive: true,
        deletedAt: null,
      },
      include: { brand: true },
    });

    const byId = new Map(items.map((item) => [item.id, item]));
    let ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof items;

    if (sort === "price-asc") {
      ordered = [...ordered].sort((a, b) => a.pricePkr - b.pricePkr);
    } else if (sort === "price-desc") {
      ordered = [...ordered].sort((a, b) => b.pricePkr - a.pricePkr);
    } else if (sort === "name" || sort === "name-asc") {
      ordered = [...ordered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "featured") {
      ordered = [...ordered].sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
    } else if (sort === "latest") {
      ordered = [...ordered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return ordered.slice(skipValue, skipValue + takeValue);
  }

  const where: any = {
    approvalStatus: "APPROVED",
    isActive: true,
    deletedAt: null,
  };
  const andConditions: any[] = [];

  // Handle brand filter
  if (brandId) {
    where.brandId = brandId;
  }

  // Handle top category filter (case-insensitive). Build AND conditions to avoid
  // clobbering the search OR later.
  if (resolvedTopCategory || effectiveJuniorCategory) {
    const expanded = expandCatalogTopCategory(resolvedTopCategory, effectiveJuniorCategory);
    if (expanded.length === 1) {
      andConditions.push({ topCategory: { equals: expanded[0], mode: "insensitive" } });
    } else if (expanded.length > 1) {
      andConditions.push({ OR: expanded.map((value) => ({ topCategory: { equals: value, mode: "insensitive" } })) });
    }
  }

  // Handle product type filter
  if (effectiveType) {
    andConditions.push({ type: { equals: effectiveType, mode: "insensitive" } });
  }

  // Handle subcategory filter
  if (effectiveSubCategory) {
    andConditions.push({ subCategory: { equals: effectiveSubCategory, mode: "insensitive" } });
  }

  // Handle size filter - check if size is in the sizes array
  if (effectiveSize) {
    // Prisma's `has` is exact-match. Assume sizes are stored with consistent casing.
    andConditions.push({ sizes: { has: effectiveSize } });
  }

  if (effectiveColor) {
    andConditions.push({ color: { contains: effectiveColor, mode: "insensitive" } });
  }

  if (Number.isFinite(minPriceValue)) {
    andConditions.push({ pricePkr: { gte: minPriceValue } });
  }
  if (Number.isFinite(maxPriceValue)) {
    andConditions.push({ pricePkr: { lte: maxPriceValue } });
  }

  for (const token of effectiveSearchTokens) {
    andConditions.push(buildSearchTokenCondition(token));
  }

  // Determine sort order
  const orderBy: any = {};
  if (sort === "latest") {
    orderBy.createdAt = "desc";
  } else if (sort === "oldest") {
    orderBy.createdAt = "asc";
  } else if (sort === "price-low" || sort === "price-asc") {
    orderBy.pricePkr = "asc";
  } else if (sort === "price-high" || sort === "price-desc") {
    orderBy.pricePkr = "desc";
  } else if (sort === "name-asc" || sort === "name") {
    orderBy.name = "asc";
  } else if (sort === "name-desc") {
    orderBy.name = "desc";
  } else if (sort === "featured") {
    orderBy.discountPercentage = "desc";
  }

  // Compose final where clause from AND / OR pieces
  if (andConditions.length) where.AND = andConditions;

  return prisma.product.findMany({
    where,
    include: {
      brand: true,
    },
    orderBy: Object.keys(orderBy).length > 0 ? orderBy : undefined,
    skip: skipValue,
    take: takeValue,
  });
}
