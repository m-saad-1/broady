const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/api/src/modules/products/product.service.ts');
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

const startIndex = lines.findIndex(line => line.includes('export async function getProductFilterOptions(options: Record<string, any>) {'));
if (startIndex === -1) {
    console.error("Could not find start index");
    process.exit(1);
}

const before = lines.slice(0, startIndex);
// wait, I also need to add the imports!
const importLineIndex = before.findIndex(line => line.includes('import { resolveBroadyTaxonomy } from "./product-taxonomy.js";'));
if (importLineIndex !== -1) {
    before.splice(importLineIndex + 1, 0, 'import { getAvailableFilters, buildWhereClause, type FilterState } from "./filter.service.js";');
}

// Ensure the `createProduct` and `updateProduct` use `as any` correctly
const createDataIndex = before.findIndex(line => line.includes('      isActive: options?.isActive ?? productData.isActive ?? true,'));
if (createDataIndex !== -1 && !before[createDataIndex].includes('as any')) {
    before[createDataIndex] = before[createDataIndex].replace('},', '} as any,');
}

const updateDataIndex = before.findIndex(line => line.includes('...pricing,'));
if (updateDataIndex !== -1) {
    const updateDataEndIndex = before.findIndex((line, i) => i > updateDataIndex && line.includes('},'));
    if (updateDataEndIndex !== -1 && !before[updateDataEndIndex].includes('as any')) {
        before[updateDataEndIndex] = before[updateDataEndIndex].replace('},', '} as any,');
    }
}

const resolveTaxonomyIndex = before.findIndex(line => line.includes('...(existingProduct as Partial<ProductCreateData>),'));
if (resolveTaxonomyIndex !== -1) {
    before[resolveTaxonomyIndex] = before[resolveTaxonomyIndex].replace('Partial<ProductCreateData>', 'any');
}


const replacement = `export function mapOptionsToFilterState(options: Record<string, any>): FilterState {
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
  const effectiveCategoryValues = normalizeQueryValues(category).map((value) => value.toUpperCase());
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
    const res = await runMeilisearchProductSearch(filters.search || "", {
      brandId: filters.brandId?.[0],
      gender: filters.gender?.[0],
      topCategory: options.topCategory,
      juniorCategory: options.juniorCategory,
      productType: options.productType,
      subCategory: filters.subcategory?.[0] || filters.category?.[0],
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
`;

const finalContent = before.join('\n') + '\n' + replacement;

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Patched successfully");
