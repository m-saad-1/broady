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
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    searchDocument: product.searchDocument ?? "",
    brandId: product.brandId,
    brandName: product.brand.name,
    brandSlug: product.brand.slug,
    pricePkr: product.pricePkr,
    topCategory: product.topCategory,
    subCategory: product.subCategory,
    sizes: product.sizes ?? [],
    imageUrl: product.imageUrl ?? "",
    stock: product.stock,
    isActive: product.isActive,
    approvalStatus: product.approvalStatus,
    createdAt: toUnixSeconds(product.createdAt),
    updatedAt: toUnixSeconds(product.updatedAt),
    averageRating: agg?.averageRating ?? 0,
    totalReviews: agg?.totalReviews ?? 0,
  };
}

/** Index settings applied after create / on each sync setup. */
export function getProductsIndexSettings(): Settings {
  return {
    searchableAttributes: [
      "name",
      "description",
      "searchDocument",
      "brandName",
      "slug",
      "brandSlug",
      "topCategory",
      "subCategory",
    ],
    filterableAttributes: [
      "brandId",
      "brandSlug",
      "topCategory",
      "subCategory",
      "pricePkr",
      "isActive",
      "approvalStatus",
      "stock",
      "sizes",
    ],
    sortableAttributes: ["pricePkr", "createdAt", "updatedAt", "averageRating", "totalReviews", "stock"],
    displayedAttributes: [
      "id",
      "name",
      "slug",
      "description",
      "searchDocument",
      "brandId",
      "brandName",
      "brandSlug",
      "pricePkr",
      "topCategory",
      "subCategory",
      "sizes",
      "imageUrl",
      "stock",
      "isActive",
      "approvalStatus",
      "createdAt",
      "updatedAt",
      "averageRating",
      "totalReviews",
    ],
    rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    typoTolerance: { enabled: true },
    pagination: { maxTotalHits: 10_000 },
  };
}
