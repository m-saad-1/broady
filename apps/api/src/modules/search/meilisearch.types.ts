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
  brandId: string;
  brandName: string;
  brandSlug: string;
  pricePkr: number;
  actualPrice: number | null;
  salePrice: number | null;
  discountPercentage: number | null;
  gender: string;
  juniorsGroup?: string;
  color: string;
  productType: string;
  topCategory: string;
  subCategory: string;
  sizes: string[];
  tags: string[];
  featured?: boolean;
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
  /** When true: category/subcategory was inferred and should be reviewed manually. */
  needsReview?: boolean;
};
