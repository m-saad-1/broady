import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { productBaseSchema } from "./product.validation.js";
import {
  correctSearchInput,
  normalizeSearchInput,
  tokenizeSearchQuery,
} from "./products.search-utils.js";
import {
  isMeilisearchProductSearchEnabled,
  runMeilisearchProductSearch,
} from "./products.meilisearch-search.js";
import { z } from "zod";
import { resolveBroadyTaxonomy } from "./product-taxonomy.js";
import { getAvailableFilters, buildWhereClause, type FilterState } from "./filter.service.js";

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
  return { [field]: { contains: token, mode: "insensitive" as any } };
}

function normalizeQueryValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeQueryValues(entry));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function mapTopCategoryToGenderValues(topCategory?: string, juniorCategory?: string) {
  if (!topCategory) return [] as string[];
  if (topCategory === "Juniors") {
    if (juniorCategory === "Junior Girls" || juniorCategory === "Toddler Girls") return ["girls"];
    if (juniorCategory === "Junior Boys" || juniorCategory === "Toddler Boys") return ["boys"];
    return ["boys", "girls"];
  }
  if (topCategory === "Women") return ["women"];
  if (topCategory === "Men") return ["men"];
  if (topCategory === "Junior Girls" || topCategory === "Toddler Girls") return ["girls"];
  if (topCategory === "Junior Boys" || topCategory === "Toddler Boys") return ["boys"];
  return [];
}

function resolveTaxonomyPayload(data: Partial<ProductCreateData>) {
  const taxonomy = resolveBroadyTaxonomy({
    name: data.name,
    rawGender: data.gender,
    rawTopCategory: data.topCategory,
    rawCategory: data.category || data.subCategory || data.type,
    rawSubCategory: data.subType || data.subCategory,
    productUrl: data.productUrl,
    sizes: data.sizes,
  });

  return {
    gender: taxonomy.gender || "women",
    division: data.division || taxonomy.division || "top",
    category: data.category || taxonomy.category || "top",
    subType: data.subType || taxonomy.subType || undefined,
    subTypeConfidence: data.subTypeConfidence || taxonomy.subTypeConfidence,
    mappingStatus: data.mappingStatus || taxonomy.mappingStatus,
    resolutionSource: data.resolutionSource || taxonomy.resolutionSource,
    pageContext: data.pageContext || taxonomy.pageContext,
    topCategory: data.topCategory || taxonomy.topCategory,
    subCategory: data.subCategory || taxonomy.legacySubCategory,
    type: data.type || taxonomy.legacyProductType,
  };
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
      containsToken("division", token),
      containsToken("category", token),
      containsToken("subType", token),
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
          OR: [
            { name: { contains: token, mode: "insensitive" as any } },
            { slug: { contains: token, mode: "insensitive" as any } },
            { description: { contains: token, mode: "insensitive" as any } },
          ],
        },
      },
      {
        variants: {
          some: {
            deletedAt: null,
            OR: [
              { sku: { contains: token, mode: "insensitive" as any } },
              { barcode: { contains: token, mode: "insensitive" as any } },
              { color: { contains: token, mode: "insensitive" as any } },
              { size: { in: variants } },
              { fit: { contains: token, mode: "insensitive" as any } },
              { season: { contains: token, mode: "insensitive" as any } },
              { style: { contains: token, mode: "insensitive" as any } },
            ],
          },
        },
      },
      {
        detail: {
          is: {
            OR: [
              { fabricComposition: { contains: token, mode: "insensitive" as any } },
              { careGuide: { contains: token, mode: "insensitive" as any } },
              { fitDetails: { contains: token, mode: "insensitive" as any } },
              { modelDetails: { contains: token, mode: "insensitive" as any } },
              { sizeGuideText: { contains: token, mode: "insensitive" as any } },
              { shippingDelivery: { contains: token, mode: "insensitive" as any } },
              { returnExchangePolicy: { contains: token, mode: "insensitive" as any } },
              { disclaimer: { contains: token, mode: "insensitive" as any } },
              { materialDetails: { contains: token, mode: "insensitive" as any } },
              { origin: { contains: token, mode: "insensitive" as any } },
              { packageIncludes: { contains: token, mode: "insensitive" as any } },
            ],
          },
        },
      },
      {
        seo: {
          is: {
            OR: [
              { metaTitle: { contains: token, mode: "insensitive" as any } },
              { metaDescription: { contains: token, mode: "insensitive" as any } },
              { canonicalUrl: { contains: token, mode: "insensitive" as any } },
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
  const taxonomy = resolveTaxonomyPayload(validation.data);

  const product = await prisma.product.create({
    data: {
      ...productData,
      ...taxonomy,
      brandId,
      ...pricing,
      currency: productData.currency || "PKR",
      visibility: productData.visibility || "visible",
      source: options?.source || productData.source || "manual",
      isActive: options?.isActive ?? productData.isActive ?? true,
    } as any,
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
    const taxonomy = resolveTaxonomyPayload({
      ...existingProduct as any,
      ...validation.data,
    });

    await prisma.product.update({
        where: { id },
        data: {
          ...productData,
          ...taxonomy,
          ...pricing,
        } as any,
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

export function mapOptionsToFilterState(options: Record<string, any>): FilterState {
  const {
    brandId,
    brand,
    gender,
    topCategory,
    juniorCategory,
    division,
    department,
    category,
    subType,
    subcategory,
    size,
    sizes,
    colors,
    color,
    minPrice,
    maxPrice,
    q,
    query,
  } = options;

  const resolvedTopCategory = typeof topCategory === "string" && topCategory ? topCategory : undefined;
  const resolvedJuniorCategory = typeof juniorCategory === "string" && juniorCategory ? juniorCategory : undefined;
  
  const effectiveGenderValues = Array.from(
    new Set([
      ...normalizeQueryValues(gender).map((value) => value.toUpperCase()),
      ...mapTopCategoryToGenderValues(resolvedTopCategory, resolvedJuniorCategory).map(v => v.toUpperCase()),
    ]),
  ).filter((value) => ["MEN", "WOMEN", "BOYS", "GIRLS", "UNISEX"].includes(value));
  
  const effectiveBrandIds = normalizeQueryValues(brandId ?? brand);
  const effectiveDepartmentValues = normalizeQueryValues(department ?? division).map((value) => value.toUpperCase());
  const effectiveCategoryValues = normalizeQueryValues(category).map((value) => {
    const norm = value.toUpperCase().replace(/[\s-]/g, "_");
    const map: Record<string, string> = {
      SHIRT: "SHIRTS", T_SHIRT: "T_SHIRTS", TSHIRT: "T_SHIRTS", POLO: "POLOS",
      JEAN: "JEANS", TROUSER: "TROUSERS", SHORT: "SHORTS", HOODIE: "HOODIES",
      JACKET: "JACKETS", SNEAKER: "SNEAKERS", LOAFER: "LOAFERS", SANDAL: "SANDALS",
      CAP: "CAPS", BAG: "BAGS", BELT: "BELTS", SOCK: "SOCKS", SWEATSHIRT: "SWEATSHIRTS",
      JOGGER: "JOGGERS", KURTA: "KURTAS", WAISTCOAT: "WAISTCOATS", BLAZER: "BLAZERS",
      COAT: "COATS", SWEATER: "SWEATERS", CARDIGAN: "CARDIGANS", VEST: "VESTS",
      DRESS: "DRESSES", SKIRT: "SKIRTS", LEGGING: "LEGGINGS", BOOT: "BOOTS",
      FLAT: "FLATS", HEEL: "HEELS", SLIPPER: "SLIPPERS", WATCH: "WATCHES", WALLET: "WALLETS",
      SCARF: "SCARVES", TIE: "TIES"
    };
    return map[norm] || norm;
  });
  const effectiveSubCategoryValues = normalizeQueryValues(subcategory ?? subType).map((value) => value.toUpperCase());
  const effectiveSizeValues = normalizeQueryValues(size ?? sizes);
  const effectiveColorValues = normalizeQueryValues(color ?? colors);
  
  const minPriceValue = typeof minPrice === "string" ? Number(minPrice) : minPrice;
  const maxPriceValue = typeof maxPrice === "string" ? Number(maxPrice) : maxPrice;
  const searchStr = typeof q === "string" && q.trim() ? q : typeof query === "string" ? query : "";

  return {
    gender: effectiveGenderValues.length ? effectiveGenderValues : undefined,
    department: effectiveDepartmentValues.length ? effectiveDepartmentValues : undefined,
    category: effectiveCategoryValues.length ? effectiveCategoryValues : undefined,
    subcategory: effectiveSubCategoryValues.length ? effectiveSubCategoryValues : undefined,
    brandId: effectiveBrandIds.length ? effectiveBrandIds : undefined,
    sizes: effectiveSizeValues.length ? effectiveSizeValues : undefined,
    colors: effectiveColorValues.length ? effectiveColorValues : undefined,
    minPrice: Number.isFinite(minPriceValue) ? minPriceValue : undefined,
    maxPrice: Number.isFinite(maxPriceValue) ? maxPriceValue : undefined,
    search: searchStr.trim() || undefined,
  };
}

export async function getProductFilterOptions(options: Record<string, any>) {
  const filters = mapOptionsToFilterState(options);
  return getAvailableFilters(filters);
}

export async function listProducts(options: Record<string, any>) {
  const { sort = "latest", page = 1, limit = 100 } = options;
  const filters = mapOptionsToFilterState(options);
  
  const pageValue = Math.max(Number(page) || 1, 1);
  const limitValue = Math.min(Math.max(Number(limit) || 100, 1), 5000);
  const skipValue = (pageValue - 1) * limitValue;
  const takeValue = limitValue;

  const hasAnyFilters = Object.values(filters).some(v => v !== undefined && v !== "");
  const isShortQuery = filters.search && filters.search.trim().length > 0 && filters.search.trim().length < 2 && !hasAnyFilters;

  if (isShortQuery && !hasAnyFilters) {
    return [];
  }

  if (isMeilisearchProductSearchEnabled()) {
    const rawCategoryForMeili = options.subcategory || options.category || "";
    const meiliSubCategory = (() => {
       const norm = rawCategoryForMeili.toString().toLowerCase();
       const map: Record<string, string> = {
        shirt: "Shirts", shirts: "Shirts",
        "t-shirt": "T-Shirts", t_shirts: "T-Shirts",
        polo: "Polo Shirts", polos: "Polo Shirts",
        hoodie: "Hoodies", hoodies: "Hoodies",
        sweatshirt: "Hoodies", sweatshirts: "Hoodies",
        jacket: "Jackets", jackets: "Jackets",
        sweater: "Sweaters", sweaters: "Sweaters",
        jeans: "Jeans",
        trouser: "Trousers", trousers: "Trousers",
        pant: "Pants", pants: "Pants",
        shorts: "Shorts",
        skirt: "Skirts", skirts: "Skirts",
        jogger: "Joggers", joggers: "Joggers",
        cargo: "Cargo Pants", cargo_pants: "Cargo Pants",
        sneaker: "Sneakers", sneakers: "Sneakers",
        trainer: "Trainers", trainers: "Trainers",
        loafer: "Loafers", loafers: "Loafers",
        sandal: "Sandals", sandals: "Sandals",
        slipper: "Slippers", slippers: "Slippers",
        boot: "Boots", boots: "Boots",
        closed_shoe: "Shoes", formal_shoe: "Shoes", open_shoe: "Shoes",
        bag: "Bags", bags: "Bags",
        cap: "Caps", caps: "Caps",
        belt: "Belts", belts: "Belts",
        watch: "Watches", watches: "Watches",
        wallet: "Wallets", wallets: "Wallets",
        socks: "Socks",
        scarf: "Scarves", scarves: "Scarves",
        sunglasses: "Sunglasses",
        jewellery: "Jewelry", jewelry: "Jewelry"
      };
      return map[norm] || undefined;
    })();

    const res = await runMeilisearchProductSearch(filters.search || "", {
      brandId: filters.brandId?.[0],
      department: filters.department?.[0],
      gender: filters.gender?.[0],
      topCategory: options.topCategory,
      juniorCategory: options.juniorCategory,
      productType: options.productType,
      subCategory: meiliSubCategory || filters.subcategory?.[0] || filters.category?.[0],
      size: filters.sizes?.[0],
      color: filters.colors?.[0],
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      limit: skipValue + takeValue,
    });

    if (!res.ids.length) {
      return [];
    }

    const items = await prisma.product.findMany({
      where: {
        id: { in: res.ids },
        approvalStatus: "APPROVED",
        isActive: true,
        deletedAt: null,
      },
      include: { brand: true },
    });

    const byId = new Map(items.map((item) => [item.id, item]));
    let ordered = res.ids.map((id: string) => byId.get(id)).filter(Boolean) as typeof items;

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

  const where = buildWhereClause(filters);
  
  if (filters.search) {
    const tokens = tokenizeSearchQuery(filters.search);
    if (tokens.length) {
      where.AND = tokens.map(buildSearchTokenCondition);
    }
  }

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
