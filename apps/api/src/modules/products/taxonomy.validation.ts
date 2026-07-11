/**
 * Zod Validation Schemas for Taxonomy System
 */

import { z } from 'zod';
import {
  Gender,
  ProductType,
  Department,
  Category,
  Subcategory,
  AvailabilityStatus,
} from './taxonomy.js';

/**
 * Enum schemas
 */
export const GenderSchema = z.nativeEnum(Gender);
export const ProductTypeSchema = z.nativeEnum(ProductType);
export const DepartmentSchema = z.nativeEnum(Department);
export const CategorySchema = z.nativeEnum(Category);
export const SubcategorySchema = z.nativeEnum(Subcategory).nullable();
export const AvailabilityStatusSchema = z.nativeEnum(AvailabilityStatus);

/**
 * Product creation schema with taxonomy
 */
export const CreateProductSchema = z.object({
  brandId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  shortDescription: z.string().max(160).optional(),

  // Taxonomy fields (required)
  gender: GenderSchema,
  productType: ProductTypeSchema,
  department: DepartmentSchema,
  category: CategorySchema,
  subcategory: SubcategorySchema,

  // Brand taxonomy (for auditing)
  brandCategoryRaw: z.string().nullable().optional(),
  brandSubcategoryRaw: z.string().nullable().optional(),

  // Product attributes
  colors: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  material: z.string().nullable().optional(),
  fit: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  searchKeywords: z.array(z.string()).default([]),

  // Status fields
  availabilityStatus: AvailabilityStatusSchema.default(AvailabilityStatus.IN_STOCK),
  isFeatured: z.boolean().default(false),
  isRecommended: z.boolean().default(false),

  // Classification metadata
  classificationConfidence: z.number().min(0).max(1).optional(),

  // Pricing
  pricePkr: z.number().int().positive(),
  actualPrice: z.number().positive(),
  salePrice: z.number().positive().nullable().optional(),
  discountPercentage: z.number().min(0).max(100).nullable().optional(),

  // Media
  imageUrl: z.string().url(),
  productUrl: z.string().url().nullable().optional(),

  // Inventory
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),

  // Import metadata
  externalProductId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Product update schema (all fields optional)
 */
export const UpdateProductSchema = CreateProductSchema.partial().omit({
  brandId: true,
});

/**
 * Product filter schema
 */
export const ProductFilterSchema = z.object({
  gender: z.array(GenderSchema).optional(),
  department: z.array(DepartmentSchema).optional(),
  category: z.array(CategorySchema).optional(),
  subcategory: z.array(SubcategorySchema).optional(),
  brandId: z.array(z.string().cuid()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  availabilityStatus: z.array(AvailabilityStatusSchema).optional(),
  isFeatured: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'name']).default('newest'),
});

/**
 * Classification review schema
 */
export const ClassificationReviewSchema = z.object({
  action: z.enum(['approve', 'edit', 'reject']),
  gender: GenderSchema.optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  reviewNote: z.string().optional(),
});

/**
 * Bulk import schema
 */
export const BulkImportSchema = z.object({
  brandId: z.string().cuid(),
  brandName: z.string(),
  source: z.enum(['SHOPIFY_JSON', 'WOOCOMMERCE_JSON', 'CUSTOM_JSON', 'CSV', 'MANUAL_UPLOAD']),
  products: z.array(z.record(z.any())),
  autoApprove: z.boolean().default(false),
});

/**
 * Available filters response schema
 */
export const AvailableFiltersSchema = z.object({
  availableGenders: z.array(
    z.object({
      value: GenderSchema,
      label: z.string(),
      count: z.number().int(),
    })
  ),
  availableDepartments: z.array(
    z.object({
      value: DepartmentSchema,
      label: z.string(),
      count: z.number().int(),
    })
  ),
  availableCategories: z.array(
    z.object({
      value: CategorySchema,
      label: z.string(),
      count: z.number().int(),
    })
  ),
  availableSubcategories: z.array(
    z.object({
      value: SubcategorySchema,
      label: z.string(),
      count: z.number().int(),
    })
  ),
  availableSizes: z.array(
    z.object({
      value: z.string(),
      count: z.number().int(),
    })
  ),
  availableColors: z.array(
    z.object({
      value: z.string(),
      count: z.number().int(),
    })
  ),
  priceRange: z.object({
    min: z.number().int(),
    max: z.number().int(),
  }),
  totalCount: z.number().int(),
});

/**
 * Type exports
 */
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductFilterInput = z.infer<typeof ProductFilterSchema>;
export type ClassificationReviewInput = z.infer<typeof ClassificationReviewSchema>;
export type BulkImportInput = z.infer<typeof BulkImportSchema>;
export type AvailableFiltersOutput = z.infer<typeof AvailableFiltersSchema>;
