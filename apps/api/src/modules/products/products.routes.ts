import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { cache } from "../../config/cache.js";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import { productCache } from "./product-cache.service.js";
import {
  productApprovalStatuses,
  productBaseSchema,
  productDeliveriesReturnsSchema,
  productFabricCareSchema,
  productShippingDeliverySchema,
  productSizeGuideSchema,
  productTemplateTypes,
} from "./product.validation.js";
import {
  buildPrefixTsQuery,
  colorWords,
  detectTopCategoryToken,
  inferQueryCategory,
  inferSubCategoryHints,
  normalizeSearchInput,
  subCategoryHintMap,
  tokenizeSearchQuery,
} from "./products.search-utils.js";

const router = Router();

const productCreateSchema = productBaseSchema.extend({
  brandId: z.string().trim().min(1),
  approvalStatus: z.enum(productApprovalStatuses).optional(),
});

const productUpdateSchema = productCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

const productTypeMap: Record<string, string[]> = {
  Top: ["T-Shirts", "Polo Shirts", "V-Neck", "Formal Shirts", "Hoodies", "Sweatshirts", "Clothing", "Outerwear", "Dresses"],
  Bottom: ["Jeans", "Trousers", "Joggers", "Cargo Pants", "Skirts"],
  Footwear: ["Slip Ons", "Sneakers", "Boots", "Sandals", "Loafers", "Footwear"],
  Accessories: ["Bags", "Belts", "Caps", "Jewelry", "Accessories"],
};

async function getTemplateScope(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, brandId: true },
  });

  if (!user) return null;

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return { role: user.role, brandId: null as string | null };
  }

  if (user.role === "BRAND" || user.role === "BRAND_ADMIN" || user.role === "BRAND_STAFF") {
    if (user.brandId) {
      return { role: user.role, brandId: user.brandId };
    }

    const membership = await prisma.brandMember.findFirst({
      where: { userId: user.id },
      select: { brandId: true },
    });

    if (membership?.brandId) {
      return { role: user.role, brandId: membership.brandId };
    }
  }

  return null;
}

async function attachSoldCounts<T extends { id: string }>(products: T[]) {
  if (!products.length) {
    return products;
  }

  const soldTotals = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: products.map((product) => product.id) },
      order: { status: "DELIVERED" },
    },
    _sum: { quantity: true },
  });

  const soldCountByProductId = new Map(soldTotals.map((entry) => [entry.productId, entry._sum.quantity || 0]));
  return products.map((product) => ({
    ...product,
    soldCount: soldCountByProductId.get(product.id) || 0,
  }));
}

const topSubCategories = productTypeMap.Top;
const bottomSubCategories = productTypeMap.Bottom;
const footwearSubCategories = productTypeMap.Footwear;
const accessoriesSubCategories = productTypeMap.Accessories;

type ProductSearchFilters = {
  brand?: string;
  topCategory?: string;
  productType?: string;
  subCategory?: string;
  subCategoryHints?: string[];
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  // NEW: Category-aware search flags
  shouldEnforceNameMatch?: boolean;    // If true, require keyword to appear in product name (avoid description-only matches)
  nameMatchTokens?: string[];           // Tokens that should appear in name for category-intent searches
};

function buildFilterConditions(parsed: {
  brand?: string;
  topCategory?: string;
  productType?: string;
  subCategory?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`p."approvalStatus" = 'APPROVED'::"ProductApprovalStatus"`,
  ];

  if (parsed.brand) {
    conditions.push(Prisma.sql`b."slug" = ${parsed.brand}`);
  }

   if (parsed.topCategory) {
     conditions.push(Prisma.sql`p."topCategory" = ${parsed.topCategory}`);
   }

  if (parsed.productType && productTypeMap[parsed.productType]) {
    conditions.push(Prisma.sql`p."subCategory" IN (${Prisma.join(productTypeMap[parsed.productType])})`);
  }

  if (parsed.subCategory) {
    conditions.push(Prisma.sql`p."subCategory" = ${parsed.subCategory}`);
  }


  if (parsed.size) {
    conditions.push(Prisma.sql`${parsed.size} = ANY(p."sizes")`);
  }

  if (typeof parsed.minPrice === "number") {
    conditions.push(Prisma.sql`p."pricePkr" >= ${parsed.minPrice}`);
  }

  if (typeof parsed.maxPrice === "number") {
    conditions.push(Prisma.sql`p."pricePkr" <= ${parsed.maxPrice}`);
  }

  return conditions;
}

async function runRankedProductSearch(q: string, filters: ProductSearchFilters) {
  const searchTerms = tokenizeSearchQuery(q);
  const hasSearchTerms = searchTerms.length > 0;
  const prefixQuery = buildPrefixTsQuery(q);
  const searchConditions = buildFilterConditions(filters);
  const inferredProductType = Prisma.sql`
    CASE
      WHEN p."subCategory" IN (${Prisma.join(topSubCategories)}) THEN 'Top'
      WHEN p."subCategory" IN (${Prisma.join(bottomSubCategories)}) THEN 'Bottom'
      WHEN p."subCategory" IN (${Prisma.join(footwearSubCategories)}) THEN 'Footwear'
      WHEN p."subCategory" IN (${Prisma.join(accessoriesSubCategories)}) THEN 'Accessories'
      ELSE 'Top'
    END
  `;
  const searchableText = Prisma.sql`
    concat_ws(
      ' ',
      coalesce(p."name", ''),
      coalesce(p."topCategory", ''),
      coalesce(p."subCategory", ''),
      coalesce(${inferredProductType}, ''),
      coalesce(p."searchDocument", ''),
      coalesce(array_to_string(p."sizes", ' '), ''),
      coalesce(p."description", ''),
      coalesce(b."name", '')
    )
  `;
  const searchableTextLower = Prisma.sql`lower(${searchableText})`;
  const searchVector = Prisma.sql`to_tsvector('english', ${searchableText})`;
  const searchQuery = prefixQuery ? Prisma.sql`to_tsquery('english', ${prefixQuery})` : null;
  const queryText = q.toLowerCase();
  const hasSubCategoryHints = Boolean(filters.subCategoryHints?.length);
  const subCategoryHintMatch = hasSubCategoryHints
    ? Prisma.sql` OR p."subCategory" IN (${Prisma.join(filters.subCategoryHints || [])})`
    : Prisma.empty;
  const subCategoryHintRankBonus = hasSubCategoryHints
    ? Prisma.sql` + CASE WHEN p."subCategory" IN (${Prisma.join(filters.subCategoryHints || [])}) THEN 1.4 ELSE 0 END`
    : Prisma.empty;
  const tokenSubCategoryMatch = hasSearchTerms
    ? Prisma.sql`
        OR EXISTS (
          SELECT 1
          FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
          WHERE lower(p."subCategory") LIKE '%' || term || '%'
        )
      `
    : Prisma.empty;
  const tokenTopCategoryMatch = hasSearchTerms
    ? Prisma.sql`
        OR EXISTS (
          SELECT 1
          FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
          WHERE lower(p."topCategory") LIKE '%' || term || '%'
        )
      `
    : Prisma.empty;
  const tokenProductTypeMatch = hasSearchTerms
    ? Prisma.sql`
        OR EXISTS (
          SELECT 1
          FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
          WHERE lower(${inferredProductType}) LIKE '%' || term || '%'
        )
      `
    : Prisma.empty;
  const tokenSubCategoryRankBonus = hasSearchTerms
    ? Prisma.sql`
        + CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
              WHERE lower(p."subCategory") LIKE '%' || term || '%'
            )
            THEN 1.2
            ELSE 0
          END
      `
    : Prisma.empty;
  const tokenProductTypeRankBonus = hasSearchTerms
    ? Prisma.sql`
        + CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
              WHERE lower(${inferredProductType}) LIKE '%' || term || '%'
            )
            THEN 0.9
            ELSE 0
          END
      `
    : Prisma.empty;
  const tokenTopCategoryRankBonus = hasSearchTerms
    ? Prisma.sql`
        + CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
              WHERE lower(p."topCategory") LIKE '%' || term || '%'
            )
            THEN 0.7
            ELSE 0
          END
      `
    : Prisma.empty;
  const tokenAnyFieldMatch = hasSearchTerms
    ? Prisma.sql`
        OR EXISTS (
          SELECT 1
          FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
          WHERE ${searchableTextLower} LIKE '%' || term || '%'
        )
      `
    : Prisma.empty;
  const tokenAnyFieldRankBonus = hasSearchTerms
    ? Prisma.sql`
        + CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(ARRAY[${Prisma.join(searchTerms)}]::text[]) AS term
              WHERE ${searchableTextLower} LIKE '%' || term || '%'
            )
            THEN 1.6
            ELSE 0
          END
      `
    : Prisma.empty;

  const enforceNameMatch = Boolean(filters.shouldEnforceNameMatch && filters.nameMatchTokens?.length);
  const nameMatchTokens = filters.nameMatchTokens || [];
  const nameIntentGuard = enforceNameMatch
    ? Prisma.sql`
      AND EXISTS (
        SELECT 1
        FROM unnest(ARRAY[${Prisma.join(nameMatchTokens)}]::text[]) AS term
        WHERE lower(p."name") LIKE '%' || term || '%'
      )
    `
    : Prisma.empty;

  const searchMatch = searchQuery
    ? Prisma.sql`
      (
        ${searchVector} @@ ${searchQuery}
        OR lower(p."name") LIKE ${queryText} || '%'
        OR lower(b."name") LIKE ${queryText} || '%'
        OR lower(p."description") LIKE '%' || ${queryText} || '%'
        OR lower(p."subCategory") LIKE ${queryText} || '%'
        OR lower(p."subCategory") LIKE '%' || ${queryText} || '%'
        OR lower(p."topCategory") LIKE ${queryText} || '%'
        OR lower(p."topCategory") LIKE '%' || ${queryText} || '%'
        OR lower(${inferredProductType}) LIKE ${queryText} || '%'
        OR lower(${inferredProductType}) LIKE '%' || ${queryText} || '%'
        OR lower(p."searchDocument") LIKE '%' || ${queryText} || '%'
        ${tokenSubCategoryMatch}
        ${tokenTopCategoryMatch}
        ${tokenProductTypeMatch}
        ${tokenAnyFieldMatch}
        OR ${queryText} = ANY(ARRAY(SELECT lower(s) FROM unnest(p."sizes") AS s))
        OR similarity(${searchableText}, ${q}) > 0.18
        ${subCategoryHintMatch}
      )
    `
    : Prisma.sql`
      (
        lower(p."name") LIKE ${queryText} || '%'
        OR lower(b."name") LIKE ${queryText} || '%'
        OR lower(p."description") LIKE '%' || ${queryText} || '%'
        OR lower(p."subCategory") LIKE ${queryText} || '%'
        OR lower(p."subCategory") LIKE '%' || ${queryText} || '%'
        OR lower(p."topCategory") LIKE ${queryText} || '%'
        OR lower(p."topCategory") LIKE '%' || ${queryText} || '%'
        OR lower(${inferredProductType}) LIKE ${queryText} || '%'
        OR lower(${inferredProductType}) LIKE '%' || ${queryText} || '%'
        OR lower(p."searchDocument") LIKE '%' || ${queryText} || '%'
        ${tokenSubCategoryMatch}
        ${tokenTopCategoryMatch}
        ${tokenProductTypeMatch}
        ${tokenAnyFieldMatch}
        OR ${queryText} = ANY(ARRAY(SELECT lower(s) FROM unnest(p."sizes") AS s))
        OR similarity(${searchableText}, ${q}) > 0.18
        ${subCategoryHintMatch}
      )
    `;

  const rankExpression = searchQuery
    ? Prisma.sql`
      (
        ts_rank_cd(${searchVector}, ${searchQuery}) * 4
        + CASE WHEN lower(p."name") LIKE ${queryText} || '%' THEN 2.5 ELSE 0 END
        + CASE WHEN lower(b."name") LIKE ${queryText} || '%' THEN 2.0 ELSE 0 END
        + CASE WHEN lower(p."subCategory") LIKE ${queryText} || '%' THEN 1.4 ELSE 0 END
        + CASE WHEN lower(p."subCategory") LIKE '%' || ${queryText} || '%' THEN 1.1 ELSE 0 END
        + CASE WHEN lower(p."topCategory") LIKE ${queryText} || '%' THEN 0.8 ELSE 0 END
        + CASE WHEN lower(p."topCategory") LIKE '%' || ${queryText} || '%' THEN 0.5 ELSE 0 END
        + CASE WHEN lower(${inferredProductType}) LIKE ${queryText} || '%' THEN 1.0 ELSE 0 END
        + CASE WHEN lower(${inferredProductType}) LIKE '%' || ${queryText} || '%' THEN 0.8 ELSE 0 END
        + CASE WHEN lower(p."searchDocument") LIKE '%' || ${queryText} || '%' THEN 0.9 ELSE 0 END
        ${tokenSubCategoryRankBonus}
        ${tokenTopCategoryRankBonus}
        ${tokenProductTypeRankBonus}
        ${tokenAnyFieldRankBonus}
        + CASE WHEN ${queryText} = ANY(ARRAY(SELECT lower(s) FROM unnest(p."sizes") AS s)) THEN 0.6 ELSE 0 END
        + similarity(${searchableText}, ${q}) * 1.5
        ${subCategoryHintRankBonus}
      )
    `
    : Prisma.sql`
      (
        CASE WHEN lower(p."name") LIKE ${queryText} || '%' THEN 2.5 ELSE 0 END
        + CASE WHEN lower(b."name") LIKE ${queryText} || '%' THEN 2.0 ELSE 0 END
        + CASE WHEN lower(p."subCategory") LIKE ${queryText} || '%' THEN 1.4 ELSE 0 END
        + CASE WHEN lower(p."subCategory") LIKE '%' || ${queryText} || '%' THEN 1.1 ELSE 0 END
        + CASE WHEN lower(p."topCategory") LIKE ${queryText} || '%' THEN 0.8 ELSE 0 END
        + CASE WHEN lower(p."topCategory") LIKE '%' || ${queryText} || '%' THEN 0.5 ELSE 0 END
        + CASE WHEN lower(${inferredProductType}) LIKE ${queryText} || '%' THEN 1.0 ELSE 0 END
        + CASE WHEN lower(${inferredProductType}) LIKE '%' || ${queryText} || '%' THEN 0.8 ELSE 0 END
        + CASE WHEN lower(p."searchDocument") LIKE '%' || ${queryText} || '%' THEN 0.9 ELSE 0 END
        ${tokenSubCategoryRankBonus}
        ${tokenTopCategoryRankBonus}
        ${tokenProductTypeRankBonus}
        ${tokenAnyFieldRankBonus}
        + CASE WHEN ${queryText} = ANY(ARRAY(SELECT lower(s) FROM unnest(p."sizes") AS s)) THEN 0.6 ELSE 0 END
        + similarity(${searchableText}, ${q}) * 1.5
        ${subCategoryHintRankBonus}
      )
    `;

  const rankedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p."id"
    FROM "Product" p
    INNER JOIN "Brand" b ON b."id" = p."brandId"
    WHERE ${Prisma.join(searchConditions, " AND ")}
      AND ${searchMatch}
      ${nameIntentGuard}
    ORDER BY ${rankExpression} DESC, p."createdAt" DESC
    LIMIT 100
  `);

  return rankedRows.map((row) => row.id);
}

async function getCorrectedQuery(normalizedQuery: string) {
  const tokens = tokenizeSearchQuery(normalizedQuery);
  if (!tokens.length) return null;

  const corrected = await Promise.all(
    tokens.map(async (token) => {
      if (token.length < 3) {
        return token;
      }

      const suggestion = await prisma.$queryRaw<Array<{ term: string }>>(Prisma.sql`
        WITH lexemes AS (
          SELECT DISTINCT lower(regexp_replace(word, '[^a-z0-9]', '', 'g')) AS term
          FROM "Product" p
          INNER JOIN "Brand" b ON b."id" = p."brandId"
          CROSS JOIN LATERAL regexp_split_to_table(
            concat_ws(
              ' ',
              coalesce(p."name", ''),
              coalesce(p."topCategory", ''),
              coalesce(p."subCategory", ''),
              coalesce(
                CASE
                  WHEN p."subCategory" IN (${Prisma.join(topSubCategories)}) THEN 'Top'
                  WHEN p."subCategory" IN (${Prisma.join(bottomSubCategories)}) THEN 'Bottom'
                  WHEN p."subCategory" IN (${Prisma.join(footwearSubCategories)}) THEN 'Footwear'
                  WHEN p."subCategory" IN (${Prisma.join(accessoriesSubCategories)}) THEN 'Accessories'
                  ELSE 'Top'
                END,
                ''
              ),
              coalesce(array_to_string(p."sizes", ' '), ''),
              coalesce(p."description", ''),
              coalesce(b."name", ''),
              coalesce(p."searchDocument", '')
            ),
            E'\\s+'
          ) AS word
          WHERE p."isActive" = true
            AND p."approvalStatus" = 'APPROVED'::"ProductApprovalStatus"
        )
        SELECT term
        FROM lexemes
        WHERE length(term) >= 3
          AND similarity(term, ${token}) > 0.34
        ORDER BY similarity(term, ${token}) DESC
        LIMIT 1
      `);

      return suggestion[0]?.term || token;
    }),
  );

  const correctedQuery = corrected.join(" ").trim();
  if (!correctedQuery || correctedQuery === normalizedQuery) {
    return null;
  }

  return correctedQuery;
}

async function clearProductCache() {
  await productCache.invalidateProductLists();
}

router.get("/", async (req, res) => {
  const querySchema = z.object({
    brand: z.string().optional(),
    topCategory: z.string().optional(),
    productType: z.string().optional(),
    subCategory: z.string().optional(),
    size: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    q: z.string().optional(),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query" });

  const cacheKey = `products:v2:${JSON.stringify(parsed.data)}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ data: cached, cached: true });

  const q = normalizeSearchInput(parsed.data.q);

  if (q && q.length < 3) {
    cache.set(cacheKey, []);
    return res.json({ data: [], correctedQuery: null });
  }

  if (q) {
    const inferredQuery = inferQueryCategory(q);
    const searchText = inferredQuery.normalizedQuery;
    const tokens = tokenizeSearchQuery(searchText);
    
    // Find product-type keywords (e.g., "shirt", "trouser", "jean") that MUST appear in product name
    // If ANY token is a known product type, only return products containing that keyword in their name
    const typeKeywords = tokens.filter(t => t in subCategoryHintMap);
    const shouldEnforceNameMatch = typeKeywords.length > 0 && !parsed.data.topCategory;
    
    // IMPORTANT: If user searches with a gender keyword (men, women, kids), apply it as a MANDATORY filter
    // This ensures "men shirt" only returns Men's products (not Women's or Kids')
    const genderKeyword = detectTopCategoryToken(tokens);
    
    // Subcategory hints are used for ranking boosts, not as hard filters.
    const subCategoryHints = inferSubCategoryHints(searchText);
    
    // Apply topCategory: explicit parameter > detected gender keyword > inferred from category detection
    const effectiveFilters = {
      ...parsed.data,
      topCategory: parsed.data.topCategory || genderKeyword || inferredQuery.inferredTopCategory,
      subCategoryHints,
      // Enforce product name must contain known type keyword(s)
      shouldEnforceNameMatch,
      nameMatchTokens: typeKeywords,
    };
    let orderedIds = await runRankedProductSearch(searchText, effectiveFilters);
    let correctedQuery: string | null = null;

    if (!orderedIds.length) {
      correctedQuery = await getCorrectedQuery(searchText);
      if (correctedQuery) {
        orderedIds = await runRankedProductSearch(correctedQuery, effectiveFilters);
      }
    }

    if (!orderedIds.length) {
      cache.set(cacheKey, []);
      return res.json({ data: [], correctedQuery });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: orderedIds } },
      include: { brand: true },
    });

    const byId = new Map(products.map((product) => [product.id, product]));
    const orderedProducts = orderedIds.map((id) => byId.get(id)).filter((product): product is (typeof products)[number] => Boolean(product));

    const productsWithSoldCounts = await attachSoldCounts(orderedProducts);
    cache.set(cacheKey, productsWithSoldCounts);
    return res.json({ data: productsWithSoldCounts, correctedQuery });
  }

  const whereClause = {
    isActive: true,
    approvalStatus: "APPROVED",
    brand: parsed.data.brand ? { slug: parsed.data.brand } : undefined,
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
    sizes: parsed.data.size ? { has: parsed.data.size } : undefined,
    pricePkr: {
      gte: parsed.data.minPrice,
      lte: parsed.data.maxPrice,
    },
  } as Prisma.ProductWhereInput;

  if (parsed.data.productType && productTypeMap[parsed.data.productType]) {
    const typeFilter = { subCategory: { in: productTypeMap[parsed.data.productType] } };
    if (parsed.data.subCategory) {
      whereClause.AND = [{ subCategory: parsed.data.subCategory }, typeFilter];
      delete whereClause.subCategory;
    } else {
      whereClause.subCategory = typeFilter.subCategory;
    }
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });
  const productsWithSoldCounts = await attachSoldCounts(products);

  cache.set(cacheKey, productsWithSoldCounts);
  return res.json({ data: productsWithSoldCounts });
});

router.get("/templates", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      type: z.enum(productTemplateTypes),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query", issues: parsed.error.flatten() });
  }

  const scope = await getTemplateScope(req.auth!.userId);
  if (!scope) {
    return res.status(403).json({ message: "Template library access is limited to admin and brand users." });
  }

  const where = {
    type: parsed.data.type,
    OR: scope.brandId ? [{ brandId: null }, { brandId: scope.brandId }] : undefined,
  };

  const templates = await (prisma as any).productContentTemplate.findMany({
    where,
    orderBy: [{ brandId: "asc" }, { name: "asc" }],
    include: {
      brand: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return res.json({ data: templates });
});

router.post("/templates", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      type: z.enum(productTemplateTypes),
      name: z.string().trim().min(2),
      content: z.unknown(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const scope = await getTemplateScope(req.auth!.userId);
  if (!scope) {
    return res.status(403).json({ message: "Template library access is limited to admin and brand users." });
  }

  const contentValidation = (() => {
    if (parsed.data.type === "SIZE_GUIDE") return productSizeGuideSchema.safeParse(parsed.data.content);
    if (parsed.data.type === "DELIVERIES_RETURNS") return productDeliveriesReturnsSchema.safeParse(parsed.data.content);
    if (parsed.data.type === "SHIPPING_DELIVERY") return productShippingDeliverySchema.safeParse(parsed.data.content);
    return productFabricCareSchema.safeParse(parsed.data.content);
  })();

  if (!contentValidation.success) {
    return res.status(400).json({ message: "Invalid template content", issues: contentValidation.error.flatten() });
  }

  try {
    const template = await (prisma as any).productContentTemplate.create({
      data: {
        type: parsed.data.type,
        name: parsed.data.name,
        content: contentValidation.data,
        brandId: scope.brandId,
        createdById: req.auth!.userId,
      },
      include: {
        brand: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return res.status(201).json({ data: template });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Template name already exists for this template type." });
    }
    throw error;
  }
});

router.get("/suggest", async (req, res) => {
  const querySchema = z.object({
    q: z.string().trim().min(1),
    topCategory: z.string().optional(),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query" });
  }

  const normalized = normalizeSearchInput(parsed.data.q);
  if (normalized.length < 2) {
    return res.json({ data: [] });
  }

  const inferredQuery = inferQueryCategory(normalized);
  const searchText = inferredQuery.normalizedQuery;
  const subCategoryHints = inferSubCategoryHints(searchText);
  const effectiveTopCategory = parsed.data.topCategory || inferredQuery.inferredTopCategory;

  const ids = await runRankedProductSearch(searchText, {
    topCategory: effectiveTopCategory,
    subCategoryHints,
  });

  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids.slice(0, 12) } },
        include: { brand: true },
      })
    : [];

  const byId = new Map(products.map((product) => [product.id, product]));
  const orderedProducts = ids.map((id) => byId.get(id)).filter((product): product is (typeof products)[number] => Boolean(product));

  const correctedQuery = await getCorrectedQuery(searchText);

  const suggestionMap = new Map<string, { id: string; label: string; query: string; topCategory?: string; kind: "query" | "product" }>();

  for (const product of orderedProducts.slice(0, 6)) {
    suggestionMap.set(`product:${product.id}`, {
      id: `product:${product.id}`,
      label: product.name,
      query: product.name,
      topCategory: product.topCategory,
      kind: "product",
    });

    const categoryPhrase = `${product.subCategory} for ${product.topCategory}`;
    const categoryKey = `category:${categoryPhrase.toLowerCase()}`;
    if (!suggestionMap.has(categoryKey)) {
      suggestionMap.set(categoryKey, {
        id: categoryKey,
        label: categoryPhrase,
        query: product.subCategory,
        topCategory: product.topCategory,
        kind: "query",
      });
    }

    const productNameTokens = tokenizeSearchQuery(product.name);
    const matchedColor = productNameTokens.find((token) => colorWords.includes(token));
    if (matchedColor) {
      const colorPhrase = `${matchedColor[0].toUpperCase()}${matchedColor.slice(1)} ${product.subCategory}`;
      const colorKey = `color:${colorPhrase.toLowerCase()}:${product.topCategory}`;
      if (!suggestionMap.has(colorKey)) {
        suggestionMap.set(colorKey, {
          id: colorKey,
          label: colorPhrase,
          query: colorPhrase,
          topCategory: product.topCategory,
          kind: "query",
        });
      }
    }
  }

  if (correctedQuery && correctedQuery !== searchText) {
    suggestionMap.set("did-you-mean", {
      id: "did-you-mean",
      label: `Did you mean "${correctedQuery}"?`,
      query: correctedQuery,
      kind: "query",
    });
  }

  return res.json({ data: Array.from(suggestionMap.values()).slice(0, 10), correctedQuery: correctedQuery || undefined });
});

router.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  const querySchema = z.object({
    topCategory: z.string().optional(),
    productType: z.string().optional(),
    subCategory: z.string().optional(),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query", issues: parsed.error.flatten() });
  }

  const whereClause: Prisma.ProductWhereInput = {
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
  };

  if (parsed.data.productType && productTypeMap[parsed.data.productType]) {
    if (parsed.data.subCategory) {
      whereClause.AND = [{ subCategory: parsed.data.subCategory }, { subCategory: { in: productTypeMap[parsed.data.productType] } }];
      delete whereClause.subCategory;
    } else {
      whereClause.subCategory = { in: productTypeMap[parsed.data.productType] };
    }
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });
  const productsWithSoldCounts = await attachSoldCounts(products);

  return res.json({ data: productsWithSoldCounts });
});

router.get("/approval/pending", requireAuth, requireAdmin, async (_req, res) => {
  const pendingWhere: Prisma.ProductWhereInput = { approvalStatus: "PENDING" };
  const products = await prisma.product.findMany({
    where: pendingWhere,
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });
  const productsWithSoldCounts = await attachSoldCounts(products);

  return res.json({ data: productsWithSoldCounts });
});

router.patch("/:id/approval", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      approvalStatus: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const product = await prisma.product.findUnique({
    where: { id: String(req.params.id) },
    include: { brand: true },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      approvalStatus: parsed.data.approvalStatus,
      isActive: parsed.data.approvalStatus === "APPROVED",
      approvalReviewedAt: new Date(),
    } as Prisma.ProductUncheckedUpdateInput,
    include: { brand: true },
  });

  queueNotificationEvent({
    name:
      parsed.data.approvalStatus === "APPROVED"
        ? notificationEventNames.productApproved
        : notificationEventNames.productRejected,
    productId: product.id,
    brandId: product.brandId,
    note: parsed.data.note,
  });

  clearProductCache();
  return res.json({ data: updated });
});

router.get("/:slug", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: {
      slug: req.params.slug,
      isActive: true,
    },
    include: { brand: true },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });
  const [productWithSoldCount] = await attachSoldCounts([product]);
  return res.json({ data: productWithSoldCount });
});

router.get("/id/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: {
      id: String(req.params.id),
      isActive: true,
    },
    include: { brand: true },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });
  const [productWithSoldCount] = await attachSoldCounts([product]);
  return res.json({ data: productWithSoldCount });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const productData: Prisma.ProductUncheckedCreateInput = {
      ...parsed.data,
      approvalStatus: parsed.data.approvalStatus || "APPROVED",
    };

    const product = await prisma.product.create({
      data: productData,
    });
    clearProductCache();
    return res.status(201).json({ data: product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Product slug already exists" });
    }
    throw error;
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const product = await prisma.product.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
      include: { brand: true },
    });
    clearProductCache();
    return res.json({ data: product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ message: "Product not found" });
      if (error.code === "P2002") return res.status(409).json({ message: "Product slug already exists" });
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const productId = String(req.params.id);
  const linkedOrderItems = await prisma.orderItem.count({ where: { productId } });
  if (linkedOrderItems > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
    clearProductCache();
    return res.json({ message: "Product archived because it is linked to existing orders" });
  }

  try {
    await prisma.product.delete({ where: { id: productId } });
    clearProductCache();
    return res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ message: "Product not found" });
    }
    throw error;
  }
});

export default router;
