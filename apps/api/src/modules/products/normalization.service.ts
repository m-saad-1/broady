/**
 * Product Normalization Service
 *
 * Entry point for product ingestion pipeline.
 * Raw Source → Extract → Classify → Normalize → Validate → Store
 */

import {
  classifyProduct,
  mapBrandCategory,
  validateClassification,
  generateSearchKeywords,
  type RawProductData,
  type ClassificationResult,
} from './classification.service.js';
import { Gender, formatEnumForDisplay } from './taxonomy.js';

export interface NormalizedProduct {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  gender: Gender;
  productType: string;
  department: string;
  category: string;
  subcategory: string | null;
  brandCategoryRaw: string | null;
  brandSubcategoryRaw: string | null;
  colors: string[];
  sizes: string[];
  material: string | null;
  fit: string | null;
  tags: string[];
  searchKeywords: string[];
  availabilityStatus: string;
  isFeatured: boolean;
  isRecommended: boolean;
  classificationConfidence: number;
  pricePkr: number;
  actualPrice: number;
  salePrice: number | null;
  discountPercentage: number | null;
  imageUrl: string;
  productUrl: string | null;
  stock: number;
  isActive: boolean;
  externalProductId: string | null;
  externalSource: string | null;
  metadata?: Record<string, any>;
}

export interface IngestionResult {
  success: boolean;
  product: NormalizedProduct | null;
  classification: ClassificationResult | null;
  errors: string[];
  warnings: string[];
  needsReview: boolean;
}

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Main ingestion pipeline
 */
export async function ingestProduct(
  rawData: any,
  brandId: string,
  brandName: string
): Promise<IngestionResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const extractedData = extractRawData(rawData);

    const validationResult = validateExtractedData(extractedData);
    if (!validationResult.valid) {
      return {
        success: false,
        product: null,
        classification: null,
        errors: validationResult.errors,
        warnings: [],
        needsReview: false,
      };
    }

    let classification = await classifyProduct(extractedData);

    const brandMapping = mapBrandCategory(
      brandName,
      extractedData.brandCategory || '',
      extractedData.brandSubcategory
    );

    if (brandMapping) {
      if (brandMapping.category) {
        classification.category = brandMapping.category;
      }
      if (brandMapping.subcategory) {
        classification.subcategory = brandMapping.subcategory;
      }
      classification.confidence = Math.min(classification.confidence + 0.15, 1.0);
      classification.method = 'RULE_BASED';
    }

    const classificationValidation = validateClassification(classification);
    if (!classificationValidation.valid) {
      errors.push(...classificationValidation.errors);
      return {
        success: false,
        product: null,
        classification,
        errors,
        warnings,
        needsReview: true,
      };
    }

    const needsReview = classification.confidence < CONFIDENCE_THRESHOLD;

    if (needsReview) {
      warnings.push(
        `Low classification confidence (${classification.confidence.toFixed(2)}). Needs manual review.`
      );
    }

    const normalizedProduct = normalizeProductData(
      rawData,
      extractedData,
      classification,
      brandId
    );

    return {
      success: true,
      product: normalizedProduct,
      classification,
      errors: [],
      warnings,
      needsReview,
    };
  } catch (error) {
    errors.push(`Ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      product: null,
      classification: null,
      errors,
      warnings,
      needsReview: false,
    };
  }
}

/**
 * Extract data from raw source
 */
function extractRawData(rawData: any): RawProductData {
  const title = rawData.title || rawData.name || rawData.productName || '';
  const description = rawData.description || rawData.desc || rawData.productDescription || '';

  const url = rawData.url || rawData.productUrl || rawData.link || null;

  const breadcrumbs = rawData.breadcrumbs || rawData.categories || [];

  const brandCategory = rawData.category || rawData.topCategory || rawData.type || null;

  const brandSubcategory =
    rawData.subcategory || rawData.subCategory || rawData.subType || null;

  const tags = rawData.tags || [];

  const gender =
    rawData.gender || rawData.targetGender || extractGenderFromBreadcrumbs(breadcrumbs) || null;

  const productType = rawData.product_type || rawData.productType || rawData.raw?.originalProductJson?.product_type || null;

  return {
    title,
    description,
    url,
    breadcrumbs: Array.isArray(breadcrumbs) ? breadcrumbs : [],
    brandCategory,
    brandSubcategory,
    tags: Array.isArray(tags) ? tags : [],
    gender,
    productType,
  };
}

/**
 * Extract gender from breadcrumbs
 */
function extractGenderFromBreadcrumbs(breadcrumbs: string[]): string | null {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
    return null;
  }

  const firstBreadcrumb = breadcrumbs[0].toLowerCase();
  if (/(men|man|gents)/i.test(firstBreadcrumb)) return 'men';
  if (/(women|woman|ladies)/i.test(firstBreadcrumb)) return 'women';
  if (/boys?/i.test(firstBreadcrumb)) return 'boys';
  if (/girls?/i.test(firstBreadcrumb)) return 'girls';
  if (/unisex/i.test(firstBreadcrumb)) return 'unisex';

  return null;
}

/**
 * Validate extracted data
 */
function validateExtractedData(data: RawProductData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Product title is required');
  }

  if (data.title && data.title.length > 200) {
    errors.push('Product title is too long (max 200 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize product data into Broady schema
 */
function normalizeProductData(
  rawData: any,
  extractedData: RawProductData,
  classification: ClassificationResult,
  brandId: string
): NormalizedProduct {
  const slug = generateSlug(extractedData.title);

  const colors = extractColors(rawData);
  const sizes = extractSizes(rawData);
  const material = extractMaterial(rawData);
  const fit = extractFit(rawData);

  const searchKeywords = generateSearchKeywords(classification, extractedData.title);

  const { actualPrice, salePrice, discountPercentage, pricePkr } = extractPricing(rawData);

  const imageUrl = extractPrimaryImage(rawData);

  const stock = rawData.stock || rawData.quantity || rawData.inventoryCount || 0;

  const isActive = rawData.isActive !== undefined ? rawData.isActive : stock > 0;

  const externalProductId = rawData.externalId || rawData.productId || rawData.id || null;

  const externalSource = rawData.source || rawData.sourceType || 'import';

  const tags = extractTags(rawData, classification);

  return {
    name: extractedData.title,
    slug,
    description: extractedData.description || extractedData.title,
    shortDescription: extractShortDescription(extractedData.description),
    gender: classification.gender,
    productType: classification.productType,
    department: classification.department,
    category: classification.category,
    subcategory: classification.subcategory,
    brandCategoryRaw: extractedData.brandCategory || null,
    brandSubcategoryRaw: extractedData.brandSubcategory || null,
    colors,
    sizes,
    material,
    fit,
    tags,
    searchKeywords,
    availabilityStatus: stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    isFeatured: false,
    isRecommended: false,
    classificationConfidence: classification.confidence,
    pricePkr,
    actualPrice,
    salePrice,
    discountPercentage,
    imageUrl,
    productUrl: extractedData.url || null,
    stock,
    isActive,
    externalProductId,
    externalSource,
    metadata: {
      classificationMethod: classification.method,
      importedAt: new Date().toISOString(),
      rawBrandCategory: extractedData.brandCategory,
      rawBrandSubcategory: extractedData.brandSubcategory,
    },
  };
}

/**
 * Generate URL-safe slug
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 100);
}

/**
 * Extract colors from raw data
 */
function extractColors(rawData: any): string[] {
  if (Array.isArray(rawData.colors)) {
    return rawData.colors.map((c: any) => (typeof c === 'string' ? c : c.name || c.value || ''));
  }

  if (rawData.color) {
    return [rawData.color];
  }

  if (rawData.variants && Array.isArray(rawData.variants)) {
    const colors = rawData.variants
      .map((v: any) => v.color as string)
      .filter((c: string) => c);
    return [...new Set(colors)] as string[];
  }

  return [];
}

/**
 * Extract sizes from raw data
 */
function extractSizes(rawData: any): string[] {
  if (Array.isArray(rawData.sizes)) {
    return rawData.sizes.map((s: any) => (typeof s === 'string' ? s : s.name || s.value || ''));
  }

  if (rawData.size) {
    return [rawData.size];
  }

  if (rawData.variants && Array.isArray(rawData.variants)) {
    const sizes = rawData.variants
      .map((v: any) => v.size as string)
      .filter((s: string) => s);
    return [...new Set(sizes)] as string[];
  }

  return [];
}

/**
 * Extract material
 */
function extractMaterial(rawData: any): string | null {
  return rawData.material || rawData.fabric || rawData.fabricType || null;
}

/**
 * Extract fit
 */
function extractFit(rawData: any): string | null {
  return rawData.fit || rawData.fitType || null;
}

/**
 * Extract pricing information
 */
function extractPricing(rawData: any): {
  actualPrice: number;
  salePrice: number | null;
  discountPercentage: number | null;
  pricePkr: number;
} {
  const price = rawData.price || rawData.pricePkr || rawData.actualPrice || 0;
  const salePrice = rawData.salePrice || rawData.discountedPrice || null;

  let discountPercentage = rawData.discountPercentage || null;

  if (salePrice && salePrice < price && !discountPercentage) {
    discountPercentage = Math.round(((price - salePrice) / price) * 100);
  }

  const pricePkr = Math.round(salePrice || price);

  return {
    actualPrice: price,
    salePrice,
    discountPercentage,
    pricePkr,
  };
}

/**
 * Extract primary image URL
 */
function extractPrimaryImage(rawData: any): string {
  if (rawData.imageUrl) {
    return rawData.imageUrl;
  }

  if (rawData.image) {
    return rawData.image;
  }

  if (Array.isArray(rawData.images) && rawData.images.length > 0) {
    return rawData.images[0];
  }

  return 'https://via.placeholder.com/500';
}

/**
 * Extract short description
 */
function extractShortDescription(description?: string): string | undefined {
  if (!description) {
    return undefined;
  }

  if (description.length <= 160) {
    return description;
  }

  return description.substring(0, 157) + '...';
}

/**
 * Extract and normalize tags
 */
function extractTags(rawData: any, classification: ClassificationResult): string[] {
  const tags = new Set<string>();

  if (Array.isArray(rawData.tags)) {
    rawData.tags.forEach((tag: string) => tags.add(tag));
  }

  tags.add(formatEnumForDisplay(classification.category));

  if (classification.subcategory) {
    tags.add(formatEnumForDisplay(classification.subcategory));
  }

  tags.add(formatEnumForDisplay(classification.department));

  return Array.from(tags);
}

/**
 * Batch ingestion for multiple products
 */
export async function ingestProductsBatch(
  rawProducts: any[],
  brandId: string,
  brandName: string
): Promise<{
  successful: IngestionResult[];
  failed: IngestionResult[];
  needsReview: IngestionResult[];
}> {
  const results = await Promise.all(
    rawProducts.map(rawData => ingestProduct(rawData, brandId, brandName))
  );

  const successful = results.filter(r => r.success && !r.needsReview);
  const failed = results.filter(r => !r.success);
  const needsReview = results.filter(r => r.success && r.needsReview);

  return {
    successful,
    failed,
    needsReview,
  };
}
