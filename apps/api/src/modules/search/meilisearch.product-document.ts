import type { Settings } from "meilisearch";
import type { Brand, Product, ProductReviewAggregate } from "@prisma/client";
import type { ProductSearchDocument } from "./meilisearch.types.js";

export const PRODUCTS_INDEX_UID = "products";

export type ProductWithBrandAndReviews = Product & {
  brand: Brand;
  reviewAggregate: ProductReviewAggregate | null;
};

function toUnixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export function mapProductToMeiliDocument(product: ProductWithBrandAndReviews): ProductSearchDocument {
  const agg = product.reviewAggregate;
  const normalized = normalizeProductTaxonomy(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    brandId: product.brandId,
    brandName: product.brand.name,
    brandSlug: product.brand.slug,
    pricePkr: product.pricePkr,
    actualPrice: product.actualPrice,
    salePrice: product.salePrice,
    discountPercentage: product.discountPercentage,
    gender: normalized.gender,
    juniorsGroup: normalized.juniorsGroup,
    color: product.color,
    productType: normalized.productType,
    topCategory: normalized.topCategory,
    subCategory: normalized.subCategory,
    sizes: product.sizes ?? [],
    tags: product.tags ?? [],
    imageUrl: product.imageUrl ?? "",
    stock: product.stock,
    isActive: product.isActive,
    approvalStatus: product.approvalStatus,
    featured: Boolean(product.discountPercentage || product.salePrice),
    createdAt: toUnixSeconds(product.createdAt),
    updatedAt: toUnixSeconds(product.updatedAt),
    averageRating: agg?.averageRating ?? 0,
    totalReviews: agg?.totalReviews ?? 0,
    needsReview: normalized.needsReview,
  };
}

export function inferSubCategoryFromName(name: string, existing?: string) {
  const n = (name || '').toLowerCase();
  if (/polo|polo shirt/.test(n)) return 'Polo Shirts';
  if (/t-?shirt|tshirt|\btee\b/.test(n)) return 'T-Shirts';
  if (/overshirt/.test(n)) return 'Shirts';
  if (/shirt\b/.test(n)) return 'Shirts';
  if (/v-?neck/.test(n)) return 'V-Neck';
  if (/formal shirt|formal/.test(n)) return 'Formal Shirts';
  if (/hoodie|sweatshirt/.test(n)) return 'Hoodies';
  if (/jacket|puffer|bomber|trench|coat/.test(n)) return 'Jackets';
  if (/skirt/.test(n)) return 'Skirts';
  if (/dress/.test(n)) return 'Dresses';
  if (/shorts?/.test(n)) return 'Shorts';
  if (/jean|denim/.test(n)) return 'Jeans';
  if (/trouser|trousers|pant|pants|chino/.test(n)) return 'Trousers';
  if (/jogger|joggers/.test(n)) return 'Joggers';
  if (/cargo/.test(n)) return 'Cargo Pants';
  if (/boot|boots/.test(n)) return 'Boots';
  if (/sandals?|flip/.test(n)) return 'Sandals';
  if (/derby/.test(n)) return 'Derby';
  if (/oxford/.test(n)) return 'Oxfords';
  if (/loafer|loafers/.test(n)) return 'Loafers';
  if (/sneaker|trainer|runner|running|high[- ]top|canvas/.test(n)) return 'Sneakers';
  if (/belt\b/.test(n)) return 'Belts';
  if (/cap\b|hat\b/.test(n)) return 'Caps';
  if (/bag\b|backpack|tote/.test(n)) return 'Bags';
  if (/socks?\b/.test(n)) return 'Socks';
  if (existing && !['clothing','footwear','accessories','bottom','top','other'].includes((existing||'').toLowerCase())) return existing;
  return existing || 'Other';
}

function normalizeTopCategoryValue(value: string | undefined) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'men') return 'Men';
  if (normalized === 'women') return 'Women';
  if (normalized === 'boys' || normalized === 'junior boys') return 'Junior Boys';
  if (normalized === 'girls' || normalized === 'junior girls') return 'Junior Girls';
  if (normalized === 'toddler boys') return 'Toddler Boys';
  if (normalized === 'toddler girls') return 'Toddler Girls';
  if (normalized === 'kids') return 'Junior Boys';
  return value || '';
}

function normalizeGenderValue(value: string | undefined, topCategory: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (["men", "man", "male"].includes(normalized)) return "Men";
  if (["women", "woman", "female"].includes(normalized)) return "Women";
  if (normalized === "juniors" || normalized === "kids") return "Juniors";

  if (topCategory && ["Junior Boys", "Junior Girls", "Toddler Boys", "Toddler Girls"].includes(topCategory)) {
    return "Juniors";
  }

  if (topCategory === "Men" || topCategory === "Women") return topCategory;
  return "Women";
}

function normalizeProductTypeValue(value: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "top") return "Top";
  if (normalized === "bottom") return "Bottom";
  if (normalized === "footwear") return "Footwear";
  if (normalized === "accessories") return "Accessories";
  return undefined;
}

function inferProductTypeFromSubCategory(value: string) {
  const map: Record<string, string> = {
    Shirts: "Top",
    "Polo Shirts": "Top",
    "T-Shirts": "Top",
    Hoodies: "Top",
    Jackets: "Top",
    Jeans: "Bottom",
    Pants: "Bottom",
    Trousers: "Bottom",
    Skirts: "Bottom",
    Sneakers: "Footwear",
    Trainers: "Footwear",
    Shoes: "Footwear",
    Pumps: "Footwear",
    Sandals: "Footwear",
    Caps: "Accessories",
    Bags: "Accessories",
    Belts: "Accessories",
    Watches: "Accessories",
  };

  return map[value] || "Top";
}

export function normalizeProductTaxonomy(product: ProductWithBrandAndReviews) {
  const origTop = (product.topCategory || '').trim();
  const origSub = (product.subCategory || '').trim();
  const rawProductType =
    (product as ProductWithBrandAndReviews & { type?: string; productType?: string }).type ??
    (product as ProductWithBrandAndReviews & { productType?: string }).productType ??
    "";
  const inferredSubCategory = inferSubCategoryFromName(product.name, origSub);
  const inferredProductType = normalizeProductTypeValue(rawProductType) || inferProductTypeFromSubCategory(inferredSubCategory);
  let needsReview = false;

  // Normalize top categories for Kids -> more specific groups
  if (origTop.toLowerCase() === 'kids') {
    const name = (product.name || '').toLowerCase();
    const sizes = (product.sizes || []).map(String).map(s => s.toLowerCase());

    // Infer gender by name tokens or sizes
    if (/\bboy\b|\bboys\b/.test(name) || sizes.some(s => /\d+y|y$/.test(s) || /^\d+$/.test(s))) {
      if (sizes.some(s => /t$/.test(s) || /0|1|2|3t/.test(s))) {
        return {
          topCategory: "Toddler Boys",
          subCategory: inferredSubCategory,
          gender: "Juniors",
          juniorsGroup: "Toddler Boys",
          productType: inferredProductType,
          needsReview,
        };
      }
      if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) {
        return {
          topCategory: "Junior Boys",
          subCategory: inferredSubCategory,
          gender: "Juniors",
          juniorsGroup: "Junior Boys",
          productType: inferredProductType,
          needsReview,
        };
      }
      needsReview = true;
      return {
        topCategory: "Junior Boys",
        subCategory: inferredSubCategory,
        gender: "Juniors",
        juniorsGroup: "Junior Boys",
        productType: inferredProductType,
        needsReview,
      };
    }

    if (/\bgirl\b|\bgirls\b/.test(name) || sizes.some(s => /girls|girl/.test(s))) {
      if (sizes.some(s => /t$/.test(s) || /0|1|2|3t/.test(s))) {
        return {
          topCategory: "Toddler Girls",
          subCategory: inferredSubCategory,
          gender: "Juniors",
          juniorsGroup: "Toddler Girls",
          productType: inferredProductType,
          needsReview,
        };
      }
      if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) {
        return {
          topCategory: "Junior Girls",
          subCategory: inferredSubCategory,
          gender: "Juniors",
          juniorsGroup: "Junior Girls",
          productType: inferredProductType,
          needsReview,
        };
      }
      needsReview = true;
      return {
        topCategory: "Junior Girls",
        subCategory: inferredSubCategory,
        gender: "Juniors",
        juniorsGroup: "Junior Girls",
        productType: inferredProductType,
        needsReview,
      };
    }

    // Footwear numeric sizes -> junior
    if (origSub && /footwear/i.test(origSub) && (product.sizes || []).some(s => /^\d+$/.test(String(s)))) {
      return {
        topCategory: "Junior Boys",
        subCategory: inferredSubCategory,
        gender: "Juniors",
        juniorsGroup: "Junior Boys",
        productType: inferredProductType,
        needsReview,
      };
    }

    // Fallback
    needsReview = true;
    return {
      topCategory: "Junior Boys",
      subCategory: inferredSubCategory,
      gender: "Juniors",
      juniorsGroup: "Junior Boys",
      productType: inferredProductType,
      needsReview,
    };
  }

  // For non-kids, ensure capitalization and refine generic subcategories
  const topNorm = normalizeTopCategoryValue(origTop) || origTop;
  const subNorm = inferredSubCategory;
  const inferredType = inferredProductType;
  const juniorsGroup = ["Junior Boys", "Junior Girls", "Toddler Boys", "Toddler Girls"].includes(topNorm)
    ? topNorm
    : undefined;
  const gender = normalizeGenderValue(product.gender, topNorm);
  return {
    topCategory: topNorm,
    subCategory: subNorm,
    gender,
    juniorsGroup,
    productType: inferredType,
    needsReview,
  };
}

/** Index settings applied after create / on each sync setup. */
export function getProductsIndexSettings(): Settings {
  return {
    searchableAttributes: [
      "name",
      "subCategory",
      "productType",
      "description",
      "tags",
      "brandName",
      "gender",
      "juniorsGroup",
      "color",
      "sizes",
    ],
    filterableAttributes: [
      "brandId",
      "brandName",
      "gender",
      "juniorsGroup",
      "color",
      "productType",
      "topCategory",
      "subCategory",
      "sizes",
      "tags",
      "pricePkr",
      "salePrice",
      "featured",
      "isActive",
      "approvalStatus",
    ],
    sortableAttributes: ["pricePkr", "salePrice", "averageRating", "totalReviews", "createdAt", "updatedAt"],
    rankingRules: [
      "exactness",
      "attribute",
      "words",
      "typo",
      "proximity",
      "sort",
      "sort:averageRating:desc",
      "sort:totalReviews:desc",
    ],
    synonyms: {
      shoe: ["footwear", "sneaker", "boot"],
    },
    stopWords: ["a", "an", "the", "in", "on", "of", "for"],
  };
}
