/**
 * Product Taxonomy API Routes
 *
 * Handles taxonomy-specific endpoints:
 * - Available filters (dynamic faceting)
 * - Classification review
 * - Bulk import with normalization
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { getAvailableFilters, type FilterState } from './filter.service.js';
import {
  ProductFilterSchema,
  ClassificationReviewSchema,
  BulkImportSchema,
} from './taxonomy.validation.js';
import { ingestProductsBatch } from './normalization.service.js';
import { formatEnumForDisplay } from './taxonomy.js';

const router = Router();

/**
 * GET /api/products/taxonomy/filters/available
 * Returns available filter values based on current filter state
 */
router.get('/filters/available', async (req, res, next) => {
  try {
    const query = req.query as any;
    const filters: FilterState = {
      gender: query.gender
        ? Array.isArray(query.gender)
          ? query.gender
          : [query.gender]
        : undefined,
      department: query.department
        ? Array.isArray(query.department)
          ? query.department
          : [query.department]
        : undefined,
      category: query.category
        ? Array.isArray(query.category)
          ? query.category
          : [query.category]
        : undefined,
      subcategory: query.subcategory
        ? Array.isArray(query.subcategory)
          ? query.subcategory
          : [query.subcategory]
        : undefined,
      brandId: query.brandId
        ? Array.isArray(query.brandId)
          ? query.brandId
          : [query.brandId]
        : undefined,
      colors: query.colors
        ? Array.isArray(query.colors)
          ? query.colors
          : [query.colors]
        : undefined,
      sizes: query.sizes
        ? Array.isArray(query.sizes)
          ? query.sizes
          : [query.sizes]
        : undefined,
      minPrice: query.minPrice ? parseInt(query.minPrice as string, 10) : undefined,
      maxPrice: query.maxPrice ? parseInt(query.maxPrice as string, 10) : undefined,
      availabilityStatus: query.availabilityStatus
        ? Array.isArray(query.availabilityStatus)
          ? query.availabilityStatus
          : [query.availabilityStatus]
        : undefined,
      search: query.search as string | undefined,
      isFeatured: query.isFeatured === 'true' ? true : undefined,
      isActive: query.isActive !== 'false',
    };

    const availableFilters = await getAvailableFilters(filters);

    res.json({
      success: true,
      data: availableFilters,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/taxonomy/classification-review
 * Returns products with low classification confidence (< 0.7)
 */
router.get('/classification-review', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          classificationConfidence: { lt: 0.7 },
          deletedAt: null,
        },
        include: {
          brand: { select: { id: true, name: true } },
        },
        orderBy: { classificationConfidence: 'asc' },
        skip,
        take: limit,
      }),
      prisma.product.count({
        where: {
          classificationConfidence: { lt: 0.7 },
          deletedAt: null,
        },
      }),
    ]);

    const formatted = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl: p.imageUrl,
      brand: p.brand,
      classification: {
        gender: p.gender,
        department: p.department,
        category: p.category,
        subcategory: p.subcategory,
        confidence: p.classificationConfidence,
      },
      formattedClassification: {
        gender: formatEnumForDisplay(p.gender),
        department: formatEnumForDisplay(p.department),
        category: formatEnumForDisplay(p.category),
        subcategory: p.subcategory ? formatEnumForDisplay(p.subcategory) : null,
      },
      brandCategoryRaw: p.brandCategoryRaw,
      brandSubcategoryRaw: p.brandSubcategoryRaw,
      createdAt: p.createdAt,
    }));

    res.json({
      success: true,
      data: {
        products: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products/taxonomy/classification-review/:productId
 * Review and update product classification
 */
router.post(
  '/classification-review/:productId',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const productId = req.params.productId as string;
      const validation = ClassificationReviewSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validation.error.errors,
        });
      }

      const { action, gender, category, subcategory, reviewNote } = validation.data;

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      if (action === 'reject') {
        await prisma.product.update({
          where: { id: productId },
          data: {
            approvalStatus: 'REJECTED',
            metadata: {
              ...(typeof product.metadata === 'object' ? product.metadata : {}),
              rejectionReason: reviewNote || 'Classification rejected',
            },
          },
        });

        return res.json({
          success: true,
          message: 'Product classification rejected',
        });
      }

      if (action === 'approve') {
        await prisma.product.update({
          where: { id: productId },
          data: {
            classificationConfidence: 1.0,
            approvalStatus: 'APPROVED',
            metadata: {
              ...(typeof product.metadata === 'object' ? product.metadata : {}),
              classificationMethod: 'MANUAL',
              reviewedBy: req.auth!.userId,
              reviewedAt: new Date().toISOString(),
              reviewNote: reviewNote || 'Classification approved',
            },
          },
        });

        return res.json({
          success: true,
          message: 'Product classification approved',
        });
      }

      if (action === 'edit') {
        if (!gender || !category) {
          return res.status(400).json({
            success: false,
            message: 'Gender and category are required for editing',
          });
        }

        const { getDepartmentFromCategory, getProductTypeFromCategory } = await import(
          './taxonomy.js'
        );

        const department = getDepartmentFromCategory(category);
        const productType = getProductTypeFromCategory(category);

        await prisma.product.update({
          where: { id: productId },
          data: {
            gender,
            department,
            productType,
            category,
            subcategory: subcategory || null,
            classificationConfidence: 1.0,
            approvalStatus: 'APPROVED',
            metadata: {
              ...(typeof product.metadata === 'object' ? product.metadata : {}),
              classificationMethod: 'MANUAL',
              reviewedBy: req.auth!.userId,
              reviewedAt: new Date().toISOString(),
              reviewNote: reviewNote || 'Classification manually corrected',
            },
          },
        });

        return res.json({
          success: true,
          message: 'Product classification updated',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid action',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/products/taxonomy/bulk-import
 * Bulk import products with automatic normalization
 */
router.post('/bulk-import', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const validation = BulkImportSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors,
      });
    }

    const { brandId, brandName, source, products, autoApprove } = validation.data;

    // Verify brand exists
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true },
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    // Process products through normalization pipeline
    const results = await ingestProductsBatch(products, brandId, brandName);

    // Save successful products to database
    const savedProducts = [];
    for (const result of results.successful) {
      if (result.product) {
        const saved = await prisma.product.create({
          data: {
            ...result.product,
            externalSource: source,
            approvalStatus: autoApprove ? 'APPROVED' : 'PENDING',
          } as any,
        });
        savedProducts.push(saved);
      }
    }

    // Save products needing review
    const reviewProducts = [];
    for (const result of results.needsReview) {
      if (result.product) {
        const saved = await prisma.product.create({
          data: {
            ...result.product,
            externalSource: source,
            approvalStatus: 'PENDING',
          } as any,
        });
        reviewProducts.push(saved);
      }
    }

    res.json({
      success: true,
      data: {
        imported: savedProducts.length,
        needsReview: reviewProducts.length,
        failed: results.failed.length,
        total: products.length,
        products: savedProducts,
        reviewQueue: reviewProducts.map(p => ({
          id: p.id,
          name: p.name,
          confidence: p.classificationConfidence,
        })),
        errors: results.failed.map(r => ({
          errors: r.errors,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/taxonomy/enums
 * Returns all available taxonomy enums for dropdowns
 */
router.get('/enums', async (req, res, next) => {
  try {
    const { Gender, Department, Category, Subcategory, AvailabilityStatus } = await import(
      './taxonomy.js'
    );

    const enums = {
      genders: Object.values(Gender).map(value => ({
        value,
        label: formatEnumForDisplay(value),
      })),
      departments: Object.values(Department).map(value => ({
        value,
        label: formatEnumForDisplay(value),
      })),
      categories: Object.values(Category).map(value => ({
        value,
        label: formatEnumForDisplay(value),
      })),
      subcategories: Object.values(Subcategory).map(value => ({
        value,
        label: formatEnumForDisplay(value),
      })),
      availabilityStatuses: Object.values(AvailabilityStatus).map(value => ({
        value,
        label: formatEnumForDisplay(value),
      })),
    };

    res.json({
      success: true,
      data: enums,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/taxonomy/subcategories
 * Returns subcategories filtered by category
 */
router.get('/subcategories', async (req, res, next) => {
  try {
    const category = req.query.category as string;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required',
      });
    }

    const { getSubcategoriesForCategory, Category } = await import('./taxonomy.js');

    if (!Object.values(Category).includes(category as any)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
      });
    }

    const subcategories = getSubcategoriesForCategory(category as any);

    const formatted = subcategories.map(value => ({
      value,
      label: formatEnumForDisplay(value),
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
