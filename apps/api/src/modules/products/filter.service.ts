/**
 * Dynamic Faceted Filtering Service
 *
 * Returns available filter values based on current filter state.
 * Implements disjunctive faceting logic (e.g. selecting MEN does not hide WOMEN).
 */

import crypto from 'node:crypto';
import { cache } from '../../config/cache.js';
import { prisma } from '../../config/prisma.js';
import type { Prisma } from '@prisma/client';
import { formatEnumForDisplay } from './taxonomy.js';

export interface FilterState {
  gender?: string[];
  department?: string[];
  category?: string[];
  subcategory?: string[];
  brandId?: string[];
  colors?: string[];
  sizes?: string[];
  fit?: string[];
  material?: string[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  availabilityStatus?: string[];
  search?: string;
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface AvailableFilters {
  availableGenders: Array<{ value: string; label: string; count: number }>;
  availableDepartments: Array<{ value: string; label: string; count: number }>;
  availableCategories: Array<{ value: string; label: string; count: number }>;
  availableSubcategories: Array<{ value: string; label: string; count: number }>;
  availableBrands: Array<{ id: string; name: string; slug: string; count: number }>;
  availableSizes: Array<{ value: string; count: number }>;
  availableColors: Array<{ value: string; count: number }>;
  availableFits?: Array<{ value: string; count: number }>;
  availableMaterials?: Array<{ value: string; count: number }>;
  priceRange: { min: number; max: number };
  totalCount: number;
}

export function buildWhereClause(filters: FilterState, excludeKey?: (keyof FilterState) | 'price'): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    isActive: filters.isActive !== undefined ? filters.isActive : true,
  };

  if (excludeKey !== 'gender' && filters.gender && filters.gender.length > 0) {
    where.gender = { in: filters.gender as any };
  }

  if (excludeKey !== 'department' && filters.department && filters.department.length > 0) {
    where.department = { in: filters.department as any };
  }

  // If excluding category, also exclude subcategory logic since it's dependent
  if (excludeKey !== 'category' && filters.category && filters.category.length > 0) {
    where.category = { in: filters.category as any };
  }

  if (excludeKey !== 'category' && excludeKey !== 'subcategory' && filters.subcategory && filters.subcategory.length > 0) {
    where.subcategory = { in: filters.subcategory as any };
  }

  if (excludeKey !== 'brandId' && filters.brandId && filters.brandId.length > 0) {
    where.brandId = { in: filters.brandId };
  }

  if (excludeKey !== 'colors' && filters.colors && filters.colors.length > 0) {
    where.colors = { hasSome: filters.colors };
  }

  if (excludeKey !== 'sizes' && filters.sizes && filters.sizes.length > 0) {
    where.sizes = { hasSome: filters.sizes };
  }
  
  if (excludeKey !== 'fit' && filters.fit && filters.fit.length > 0) {
    where.fit = { in: filters.fit };
  }
  
  if (excludeKey !== 'material' && filters.material && filters.material.length > 0) {
    where.material = { in: filters.material };
  }

  if (excludeKey !== 'price' && (filters.minPrice !== undefined || filters.maxPrice !== undefined)) {
    where.pricePkr = {};
    if (filters.minPrice !== undefined) {
      where.pricePkr.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.pricePkr.lte = filters.maxPrice;
    }
  }
  
  if (filters.minDiscount !== undefined) {
    where.discountPercentage = { gte: filters.minDiscount };
  }

  if (filters.availabilityStatus && filters.availabilityStatus.length > 0) {
    where.availabilityStatus = { in: filters.availabilityStatus as any };
  }

  if (filters.isFeatured !== undefined) {
    where.isFeatured = filters.isFeatured;
  }

  return where;
}

export async function getAvailableFilters(
  filters: FilterState
): Promise<AvailableFilters> {
  const cacheKey = `facets:${crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex')}`;
  const cached = cache.get<AvailableFilters>(cacheKey);
  if (cached) return cached;

  const baseWhere = buildWhereClause(filters); // Used for total count

  const totalCount = await prisma.product.count({ where: baseWhere });

  // 1. Gender (Exclude 'gender' filter)
  const whereGender = buildWhereClause(filters, 'gender');
  const genderCounts = await prisma.product.groupBy({
    by: ['gender'],
    where: whereGender,
    _count: { gender: true },
    orderBy: { gender: 'asc' },
  });
  const availableGenders = genderCounts.map(g => ({
    value: g.gender,
    label: formatEnumForDisplay(g.gender),
    count: g._count.gender,
  }));

  // 2. Department (Exclude 'department' filter)
  const whereDept = buildWhereClause(filters, 'department');
  const departmentCounts = await prisma.product.groupBy({
    by: ['department'],
    where: whereDept,
    _count: { department: true },
    orderBy: { department: 'asc' },
  });
  const availableDepartments = departmentCounts.map(d => ({
    value: d.department,
    label: formatEnumForDisplay(d.department),
    count: d._count.department,
  }));

  // 3. Category (Exclude 'category' filter)
  const whereCat = buildWhereClause(filters, 'category');
  const categoryCounts = await prisma.product.groupBy({
    by: ['category'],
    where: whereCat,
    _count: { category: true },
    orderBy: { category: 'asc' },
  });
  const availableCategories = categoryCounts.map(c => ({
    value: c.category,
    label: formatEnumForDisplay(c.category),
    count: c._count.category,
  }));

  // 4. Subcategory (Exclude 'subcategory' filter) - Only show if category is selected
  let availableSubcategories: Array<{ value: string; label: string; count: number }> = [];
  if (filters.category && filters.category.length > 0) {
    const whereSubcat = buildWhereClause(filters, 'subcategory');
    const subcategoryCounts = await prisma.product.groupBy({
      by: ['subcategory'],
      where: {
        ...whereSubcat,
        subcategory: { not: null },
      },
      _count: { subcategory: true },
      orderBy: { subcategory: 'asc' },
    });
    availableSubcategories = subcategoryCounts
      .filter(s => s.subcategory !== null)
      .map(s => ({
        value: s.subcategory!,
        label: formatEnumForDisplay(s.subcategory!),
        count: s._count.subcategory,
      }));
  }

  // 5. Brands (Exclude 'brandId' filter)
  const whereBrand = buildWhereClause(filters, 'brandId');
  const brandCounts = await prisma.product.groupBy({
    by: ['brandId'],
    where: whereBrand,
    _count: { brandId: true },
    orderBy: { _count: { brandId: 'desc' } },
  });
  const brandIds = brandCounts.map(b => b.brandId);
  const brands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: { id: true, name: true, slug: true },
  });
  const brandMap = new Map(brands.map(b => [b.id, { name: b.name, slug: b.slug }]));
  const availableBrands = brandCounts
    .map(b => {
      const brandInfo = brandMap.get(b.brandId) || { name: 'Unknown', slug: 'unknown' };
      return {
        id: b.brandId,
        name: brandInfo.name,
        slug: brandInfo.slug,
        count: b._count.brandId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // 6. Sizes (Exclude 'sizes' filter)
  const whereSizes = buildWhereClause(filters, 'sizes');
  const productsForSizes = await prisma.product.findMany({
    where: whereSizes,
    select: { sizes: true },
  });
  const sizeMap = new Map<string, number>();
  productsForSizes.forEach(p => {
    p.sizes.forEach(size => {
      sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
    });
  });
  const availableSizes = Array.from(sizeMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
      const aIdx = sizeOrder.indexOf(a.value);
      const bIdx = sizeOrder.indexOf(b.value);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.value.localeCompare(b.value);
    });

  // 7. Colors (Exclude 'colors' filter) - Only show if category is selected
  let availableColors: Array<{ value: string; count: number }> = [];
  if (filters.category && filters.category.length > 0) {
    const whereColors = buildWhereClause(filters, 'colors');
    const productsForColors = await prisma.product.findMany({
      where: whereColors,
      select: { colors: true },
    });
    const colorMap = new Map<string, number>();
    productsForColors.forEach(p => {
      p.colors.forEach(color => {
        colorMap.set(color, (colorMap.get(color) || 0) + 1);
      });
    });
    availableColors = Array.from(colorMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }
    
  // 8. Fit (Exclude 'fit' filter)
  const whereFit = buildWhereClause(filters, 'fit');
  const fitCounts = await prisma.product.groupBy({
    by: ['fit'],
    where: { ...whereFit, fit: { not: null } },
    _count: { fit: true },
    orderBy: { fit: 'asc' },
  });
  const availableFits = fitCounts
    .filter(f => f.fit !== null)
    .map(f => ({
      value: f.fit!,
      count: f._count.fit,
    }));
    
  // 9. Material (Exclude 'material' filter)
  const whereMaterial = buildWhereClause(filters, 'material');
  const materialCounts = await prisma.product.groupBy({
    by: ['material'],
    where: { ...whereMaterial, material: { not: null } },
    _count: { material: true },
    orderBy: { material: 'asc' },
  });
  const availableMaterials = materialCounts
    .filter(m => m.material !== null)
    .map(m => ({
      value: m.material!,
      count: m._count.material,
    }));

  // Price range - exclude 'price' filter so bounds don't shrink when sliding
  const priceWhere = buildWhereClause(filters, 'price');
  const priceAgg = await prisma.product.aggregate({
    where: priceWhere,
    _min: { pricePkr: true },
    _max: { pricePkr: true },
  });

  const result = {
    availableGenders,
    availableDepartments,
    availableCategories,
    availableSubcategories,
    availableBrands,
    availableSizes,
    availableColors,
    availableFits,
    availableMaterials,
    priceRange: {
      min: priceAgg._min.pricePkr || 0,
      max: priceAgg._max.pricePkr || 0,
    },
    totalCount,
  };

  cache.set(cacheKey, result, 60000); // 1 minute cache
  return result;
}

export function getSubcategoryLabel(category?: string): string {
  if (!category) return 'Type';

  const labelMap: Record<string, string> = {
    SHIRTS: 'Shirt Type',
    T_SHIRTS: 'T-Shirt Type',
    POLOS: 'Polo Type',
    JEANS: 'Jeans Fit',
    TROUSERS: 'Trouser Style',
    SHORTS: 'Shorts Type',
    HOODIES: 'Hoodie Style',
    JACKETS: 'Jacket Type',
    SNEAKERS: 'Sneaker Type',
    LOAFERS: 'Loafer Style',
    SANDALS: 'Sandal Type',
    CAPS: 'Cap Style',
    BAGS: 'Bag Type',
    BELTS: 'Belt Style',
    SOCKS: 'Sock Type',
  };

  return labelMap[category] || 'Type';
}
