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
  const rawProductType =
    (product as ProductWithBrandAndReviews & { type?: string; productType?: string }).type ??
    (product as ProductWithBrandAndReviews & { productType?: string }).productType ??
    "";

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
    gender: product.gender,
    color: product.color,
    productType: rawProductType,
    topCategory: normalized.topCategory,
    subCategory: normalized.subCategory,
    sizes: product.sizes ?? [],
    tags: product.tags ?? [],
    imageUrl: product.imageUrl ?? "",
    stock: product.stock,
    isActive: product.isActive,
    approvalStatus: product.approvalStatus,
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

export function normalizeProductTaxonomy(product: ProductWithBrandAndReviews) {
  const origTop = (product.topCategory || '').trim();
  const origSub = (product.subCategory || '').trim();
  let needsReview = false;

  // Normalize top categories for Kids -> more specific groups
  if (origTop.toLowerCase() === 'kids') {
    const name = (product.name || '').toLowerCase();
    const sizes = (product.sizes || []).map(String).map(s => s.toLowerCase());

    // Infer gender by name tokens or sizes
    if (/\bboy\b|\bboys\b/.test(name) || sizes.some(s => /\d+y|y$/.test(s) || /^\d+$/.test(s))) {
      if (sizes.some(s => /t$/.test(s) || /0|1|2|3t/.test(s))) {
        return { topCategory: 'Toddler Boys', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
      }
      if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) {
        return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
      }
      needsReview = true;
      return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
    }

    if (/\bgirl\b|\bgirls\b/.test(name) || sizes.some(s => /girls|girl/.test(s))) {
      if (sizes.some(s => /t$/.test(s) || /0|1|2|3t/.test(s))) {
        return { topCategory: 'Toddler Girls', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
      }
      if (sizes.some(s => /2y|4y|6y|8y|10y|12y/.test(s) || /y$/.test(s))) {
        return { topCategory: 'Junior Girls', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
      }
      needsReview = true;
      return { topCategory: 'Junior Girls', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
    }

    // Footwear numeric sizes -> junior
    if (origSub && /footwear/i.test(origSub) && (product.sizes || []).some(s => /^\d+$/.test(String(s)))) {
      return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
    }

    // Fallback
    needsReview = true;
    return { topCategory: 'Junior Boys', subCategory: inferSubCategoryFromName(product.name, origSub), needsReview };
  }

  // For non-kids, ensure capitalization and refine generic subcategories
  const topNorm = normalizeTopCategoryValue(origTop);
  const subNorm = inferSubCategoryFromName(product.name, origSub);
  return { topCategory: topNorm || origTop, subCategory: subNorm, needsReview };
}

/** Index settings applied after create / on each sync setup. */
export function getProductsIndexSettings(): Settings {
  return {
    searchableAttributes: ["name", "description", "brandName", "tags", "subCategory", "color", "productType"],
    filterableAttributes: [
      "brandId",
      "gender",
      "color",
      "productType",
      "topCategory",
      "subCategory",
      "sizes",
      "tags",
      "pricePkr",
      "salePrice",
      "rating",
      "reviewCount",
      "isAvailable",
    ],
    sortableAttributes: ["pricePkr", "salePrice", "rating", "reviewCount", "createdAt", "updatedAt"],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "sort:rating:desc",
      "sort:reviewCount:desc",
    ],
    synonyms: {
      shoe: ["footwear", "sneaker", "boot"],
    },
    stopWords: ["a", "an", "the", "in", "on", "of", "for"],
  };
}
