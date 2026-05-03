/**
 * Meilisearch document for the `products` index.
 * Primary key: `id` (same as Prisma `Product.id`).
 *
 * @see docs/Meilisearch.md
 */
export type ProductSearchDocument = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Denormalized search blob from DB (`Product.searchDocument`). */
  searchDocument: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  pricePkr: number;
  topCategory: string;
  subCategory: string;
  sizes: string[];
  imageUrl: string;
  stock: number;
  isActive: boolean;
  /** Prisma `ProductApprovalStatus` string value. */
  approvalStatus: string;
  /** Unix seconds (UTC) for stable sorting in Meilisearch. */
  createdAt: number;
  /** Unix seconds (UTC). */
  updatedAt: number;
  averageRating: number;
  totalReviews: number;
};
