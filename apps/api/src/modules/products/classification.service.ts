/**
 * Product Classification Service
 *
 * Normalizes brand-specific product data into Broady's universal taxonomy.
 * Uses rule-based matching and AI classification for confidence scoring.
 */

import {
  Gender,
  ProductType,
  Department,
  Category,
  Subcategory,
  normalizeGender,
  getDepartmentFromCategory,
  getProductTypeFromCategory,
  getCategoryFromSubcategory,
  CATEGORY_KEYWORDS,
} from './taxonomy.js';

export interface RawProductData {
  title: string;
  description?: string;
  url?: string;
  breadcrumbs?: string[];
  brandCategory?: string;
  brandSubcategory?: string;
  tags?: string[];
  gender?: string;
  productType?: string;
}

export interface ClassificationResult {
  gender: Gender;
  productType: ProductType;
  department: Department;
  category: Category;
  subcategory: Subcategory | null;
  confidence: number;
  method: 'RULE_BASED' | 'AI_ASSISTED' | 'MANUAL';
  reasoning?: string;
}

/**
 * Main classification function
 */
export async function classifyProduct(
  data: RawProductData
): Promise<ClassificationResult> {
  const textContent = buildTextContent(data);

  const gender = classifyGender(data);
  const category = classifyCategory(textContent, data);
  const subcategory = classifySubcategory(textContent, category, data);

  const department = getDepartmentFromCategory(category);
  const productType = getProductTypeFromCategory(category);

  const confidence = calculateConfidence({
    gender,
    category,
    subcategory,
    data,
  });

  const method = confidence >= 0.8 ? 'RULE_BASED' : 'AI_ASSISTED';

  return {
    gender,
    productType,
    department,
    category,
    subcategory,
    confidence,
    method,
  };
}

/**
 * Build searchable text content from product data
 */
function buildTextContent(data: RawProductData): string {
  const parts: string[] = [
    data.title,
    data.description || '',
    data.brandCategory || '',
    data.brandSubcategory || '',
    data.productType || '',
    ...(data.breadcrumbs || []),
    ...(data.tags || []),
  ];

  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify gender from product data
 */
function classifyGender(data: RawProductData): Gender {
  const genderInput =
    data.gender ||
    data.breadcrumbs?.[0] ||
    extractGenderFromText(data.title);

  if (genderInput) {
    const normalized = normalizeGender(genderInput);
    if (normalized) {
      return normalized;
    }
  }

  const textContent = buildTextContent(data);

  if (
    /\b(men|man|mens|gents)\b/i.test(textContent) &&
    !/\b(women|woman|ladies)\b/i.test(textContent)
  ) {
    return Gender.MEN;
  }

  if (
    /\b(women|woman|womens|ladies)\b/i.test(textContent) &&
    !/\b(men|man|gents)\b/i.test(textContent)
  ) {
    return Gender.WOMEN;
  }

  if (/\b(boys?|juniors?\s*boys?)\b/i.test(textContent)) {
    return Gender.BOYS;
  }

  if (/\b(girls?|juniors?\s*girls?)\b/i.test(textContent)) {
    return Gender.GIRLS;
  }

  if (/\b(unisex|uni-sex)\b/i.test(textContent)) {
    return Gender.UNISEX;
  }

  return Gender.UNISEX;
}

/**
 * Extract gender from text
 */
function extractGenderFromText(text: string): string | null {
  const match = text.match(/\b(men|women|boys|girls|unisex)\b/i);
  return match ? match[1] : null;
}

/**
 * Classify category using keyword matching
 */
function classifyCategory(
  textContent: string,
  data: RawProductData
): Category {
  let bestMatch: { category: Category; score: number } | null = null;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;

    for (const keyword of keywords as string[]) {
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}(s|es)?\\b`, 'i');

      if (regex.test(data.title)) {
        score += 10;
      }

      if (data.description && regex.test(data.description)) {
        score += 5;
      }

      if (data.brandCategory && regex.test(data.brandCategory)) {
        score += 8;
      }

      if (data.brandSubcategory && regex.test(data.brandSubcategory)) {
        score += 6;
      }

      if (data.productType && regex.test(data.productType)) {
        score += 15;
      }

      if (textContent.includes(keyword)) {
        score += 3;
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        category: category as Category,
        score,
      };
    }
  }

  return bestMatch?.category || Category.T_SHIRTS;
}

/**
 * Classify subcategory based on category and text content
 */
function classifySubcategory(
  textContent: string,
  category: Category,
  data: RawProductData
): Subcategory | null {
  const subcategoryMap: Partial<Record<Category, Partial<Record<string, Subcategory>>>> = {
    [Category.SHIRTS]: {
      textured: Subcategory.TEXTURED_SHIRT,
      embroidered: Subcategory.EMBROIDERED_SHIRT,
      knit: Subcategory.KNIT_SHIRT,
      printed: Subcategory.PRINTED_SHIRT,
      formal: Subcategory.FORMAL_SHIRT,
      casual: Subcategory.CASUAL_SHIRT,
      denim: Subcategory.DENIM_SHIRT,
      flannel: Subcategory.FLANNEL_SHIRT,
      oxford: Subcategory.OXFORD_SHIRT,
      linen: Subcategory.LINEN_SHIRT,
    },
    [Category.T_SHIRTS]: {
      graphic: Subcategory.GRAPHIC_TSHIRT,
      plain: Subcategory.PLAIN_TSHIRT,
      oversized: Subcategory.OVERSIZED_TSHIRT,
      henley: Subcategory.HENLEY_TSHIRT,
      'v-neck': Subcategory.V_NECK_TSHIRT,
      'v neck': Subcategory.V_NECK_TSHIRT,
      'crew neck': Subcategory.CREW_NECK_TSHIRT,
      pocket: Subcategory.POCKET_TSHIRT,
      striped: Subcategory.STRIPED_TSHIRT,
    },
    [Category.POLOS]: {
      pique: Subcategory.PIQUE_POLO,
      tipped: Subcategory.TIPPED_POLO,
      classic: Subcategory.CLASSIC_POLO,
      performance: Subcategory.PERFORMANCE_POLO,
    },
    [Category.JEANS]: {
      'slim fit': Subcategory.SLIM_FIT_JEANS,
      slim: Subcategory.SLIM_FIT_JEANS,
      'regular fit': Subcategory.REGULAR_FIT_JEANS,
      regular: Subcategory.REGULAR_FIT_JEANS,
      'relaxed fit': Subcategory.RELAXED_FIT_JEANS,
      relaxed: Subcategory.RELAXED_FIT_JEANS,
      skinny: Subcategory.SKINNY_JEANS,
      'straight leg': Subcategory.STRAIGHT_LEG_JEANS,
      straight: Subcategory.STRAIGHT_LEG_JEANS,
      bootcut: Subcategory.BOOTCUT_JEANS,
      distressed: Subcategory.DISTRESSED_JEANS,
      'dark wash': Subcategory.DARK_WASH_JEANS,
      'light wash': Subcategory.LIGHT_WASH_JEANS,
      'raw denim': Subcategory.RAW_DENIM_JEANS,
    },
    [Category.SNEAKERS]: {
      running: Subcategory.RUNNING_SNEAKER,
      lifestyle: Subcategory.LIFESTYLE_SNEAKER,
      training: Subcategory.TRAINING_SNEAKER,
      casual: Subcategory.CASUAL_SNEAKER,
      'high top': Subcategory.HIGH_TOP_SNEAKER,
      'low top': Subcategory.LOW_TOP_SNEAKER,
      canvas: Subcategory.CANVAS_SNEAKER,
      'slip-on': Subcategory.SLIP_ON_SNEAKER,
      'slip on': Subcategory.SLIP_ON_SNEAKER,
    },
    [Category.HOODIES]: {
      zip: Subcategory.ZIP_HOODIE,
      pullover: Subcategory.PULLOVER_HOODIE,
      graphic: Subcategory.GRAPHIC_HOODIE,
      fleece: Subcategory.FLEECE_HOODIE,
    },
    [Category.JACKETS]: {
      bomber: Subcategory.BOMBER_JACKET,
      denim: Subcategory.DENIM_JACKET,
      leather: Subcategory.LEATHER_JACKET,
      windbreaker: Subcategory.WINDBREAKER,
      puffer: Subcategory.PUFFER_JACKET,
      varsity: Subcategory.VARSITY_JACKET,
    },
  };

  const categorySubcats = subcategoryMap[category];
  if (!categorySubcats) {
    return null;
  }

  for (const [keyword, subcategory] of Object.entries(categorySubcats)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (
      regex.test(data.title) ||
      regex.test(data.description || '') ||
      regex.test(data.brandSubcategory || '')
    ) {
      return subcategory as Subcategory;
    }
  }

  return null;
}

/**
 * Calculate classification confidence
 */
function calculateConfidence(params: {
  gender: Gender;
  category: Category;
  subcategory: Subcategory | null;
  data: RawProductData;
}): number {
  const { gender, category, subcategory, data } = params;
  let confidence = 0.5;

  if (data.gender && normalizeGender(data.gender) === gender) {
    confidence += 0.2;
  }

  if (data.brandCategory) {
    confidence += 0.1;
  }

  if (data.brandSubcategory) {
    confidence += 0.1;
  }

  if (subcategory) {
    confidence += 0.1;
  }

  const keywords = CATEGORY_KEYWORDS[category] || [];
  const titleLower = data.title.toLowerCase();

  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      confidence += 0.05;
      break;
    }
  }

  return Math.min(confidence, 1.0);
}

/**
 * Map brand-specific category to Broady category
 * Brand-specific mapping rules
 */
export function mapBrandCategory(
  brandName: string,
  brandCategory: string,
  brandSubcategory?: string
): Partial<ClassificationResult> | null {
  const brandLower = brandName.toLowerCase();
  const categoryLower = brandCategory.toLowerCase();
  const subcategoryLower = brandSubcategory?.toLowerCase() || '';

  if (brandLower === 'cougar') {
    if (categoryLower.includes('shirt')) {
      if (subcategoryLower.includes('knit')) {
        return {
          category: Category.SHIRTS,
          subcategory: Subcategory.KNIT_SHIRT,
        };
      }
      if (subcategoryLower.includes('embroidered')) {
        return {
          category: Category.SHIRTS,
          subcategory: Subcategory.EMBROIDERED_SHIRT,
        };
      }
      return {
        category: Category.SHIRTS,
        subcategory: null,
      };
    }

    if (categoryLower.includes('footwear')) {
      if (subcategoryLower.includes('sneaker')) {
        return {
          category: Category.SNEAKERS,
          subcategory: null,
        };
      }
      if (subcategoryLower.includes('loafer')) {
        return {
          category: Category.LOAFERS,
          subcategory: null,
        };
      }
      if (subcategoryLower.includes('sandal')) {
        return {
          category: Category.SANDALS,
          subcategory: null,
        };
      }
    }
  }

  if (brandLower === 'outfitters') {
    if (categoryLower.includes('shirt')) {
      if (subcategoryLower.includes('textured')) {
        return {
          category: Category.SHIRTS,
          subcategory: Subcategory.TEXTURED_SHIRT,
        };
      }
      if (subcategoryLower.includes('embroidered')) {
        return {
          category: Category.SHIRTS,
          subcategory: Subcategory.EMBROIDERED_SHIRT,
        };
      }
      if (subcategoryLower.includes('oversized')) {
        return {
          category: Category.SHIRTS,
          subcategory: Subcategory.CASUAL_SHIRT,
        };
      }
    }
  }

  if (brandLower === 'breakout') {
    if (categoryLower.includes('clothing')) {
      if (subcategoryLower.includes('shirt')) {
        return {
          category: Category.SHIRTS,
          subcategory: null,
        };
      }
      if (subcategoryLower.includes('t-shirt') || subcategoryLower.includes('tshirt')) {
        return {
          category: Category.T_SHIRTS,
          subcategory: null,
        };
      }
      if (subcategoryLower.includes('polo')) {
        return {
          category: Category.POLOS,
          subcategory: null,
        };
      }
    }

    if (categoryLower.includes('accessories')) {
      if (subcategoryLower.includes('footwear')) {
        return {
          category: Category.SNEAKERS,
          subcategory: null,
        };
      }
      if (subcategoryLower.includes('bag')) {
        return {
          category: Category.BAGS,
          subcategory: null,
        };
      }
      if (subcategoryLower.includes('cap')) {
        return {
          category: Category.CAPS,
          subcategory: null,
        };
      }
    }
  }

  return null;
}

/**
 * Validate classification result
 */
export function validateClassification(
  result: ClassificationResult
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!result.gender) {
    errors.push('Gender is required');
  }

  if (!result.productType) {
    errors.push('Product type is required');
  }

  if (!result.department) {
    errors.push('Department is required');
  }

  if (!result.category) {
    errors.push('Category is required');
  }

  if (result.subcategory) {
    const expectedCategory = getCategoryFromSubcategory(result.subcategory);
    if (expectedCategory !== result.category) {
      errors.push(
        `Subcategory ${result.subcategory} does not belong to category ${result.category}`
      );
    }
  }

  const expectedDepartment = getDepartmentFromCategory(result.category);
  if (expectedDepartment !== result.department) {
    errors.push(
      `Department ${result.department} does not match category ${result.category}`
    );
  }

  const expectedProductType = getProductTypeFromCategory(result.category);
  if (expectedProductType !== result.productType) {
    errors.push(
      `Product type ${result.productType} does not match category ${result.category}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate search keywords from classification
 */
export function generateSearchKeywords(
  result: ClassificationResult,
  productName: string
): string[] {
  const keywords = new Set<string>();

  keywords.add(productName.toLowerCase());
  keywords.add(result.category.toLowerCase().replace(/_/g, ' '));

  if (result.subcategory) {
    keywords.add(result.subcategory.toLowerCase().replace(/_/g, ' '));
  }

  keywords.add(result.department.toLowerCase());
  keywords.add(result.gender.toLowerCase());

  const categoryKeywords = CATEGORY_KEYWORDS[result.category] || [];
  categoryKeywords.forEach((keyword: string) => keywords.add(keyword));

  return Array.from(keywords);
}
