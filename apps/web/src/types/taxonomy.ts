/**
 * Frontend TypeScript types for Product Taxonomy System
 */

export enum Gender {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  BOYS = 'BOYS',
  GIRLS = 'GIRLS',
  UNISEX = 'UNISEX',
}

export enum ProductType {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
  FOOTWEAR = 'FOOTWEAR',
  ACCESSORY = 'ACCESSORY',
}

export enum Department {
  CLOTHING = 'CLOTHING',
  FOOTWEAR = 'FOOTWEAR',
  ACCESSORIES = 'ACCESSORIES',
}

export enum Category {
  SHIRTS = 'SHIRTS',
  T_SHIRTS = 'T_SHIRTS',
  POLOS = 'POLOS',
  JEANS = 'JEANS',
  TROUSERS = 'TROUSERS',
  SHORTS = 'SHORTS',
  HOODIES = 'HOODIES',
  JACKETS = 'JACKETS',
  SNEAKERS = 'SNEAKERS',
  LOAFERS = 'LOAFERS',
  SANDALS = 'SANDALS',
  CAPS = 'CAPS',
  BAGS = 'BAGS',
  BELTS = 'BELTS',
  SOCKS = 'SOCKS',
  SWEATSHIRTS = 'SWEATSHIRTS',
  JOGGERS = 'JOGGERS',
  CARGO_PANTS = 'CARGO_PANTS',
  FORMAL_PANTS = 'FORMAL_PANTS',
  CHINOS = 'CHINOS',
  KURTAS = 'KURTAS',
  SHALWAR_KAMEEZ = 'SHALWAR_KAMEEZ',
  WAISTCOATS = 'WAISTCOATS',
  BLAZERS = 'BLAZERS',
  COATS = 'COATS',
  SWEATERS = 'SWEATERS',
  CARDIGANS = 'CARDIGANS',
  VESTS = 'VESTS',
  TANK_TOPS = 'TANK_TOPS',
  DRESSES = 'DRESSES',
  SKIRTS = 'SKIRTS',
  LEGGINGS = 'LEGGINGS',
  BOOTS = 'BOOTS',
  FLATS = 'FLATS',
  HEELS = 'HEELS',
  SLIPPERS = 'SLIPPERS',
  WATCHES = 'WATCHES',
  SUNGLASSES = 'SUNGLASSES',
  WALLETS = 'WALLETS',
  SCARVES = 'SCARVES',
  TIES = 'TIES',
}

export enum AvailabilityStatus {
  IN_STOCK = 'IN_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  PREORDER = 'PREORDER',
  DISCONTINUED = 'DISCONTINUED',
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;

  // Taxonomy fields
  gender: Gender;
  productType: ProductType; // Internal only, not displayed
  department: Department;
  category: Category;
  subcategory: string | null;

  // Brand taxonomy (internal, not displayed)
  brandCategoryRaw: string | null;
  brandSubcategoryRaw: string | null;

  // Product attributes
  colors: string[];
  sizes: string[];
  material: string | null;
  fit: string | null;
  tags: string[];
  searchKeywords: string[]; // Internal only
  recommendedKeywords: string[];
  searchBoost: number;

  // Status
  availabilityStatus: AvailabilityStatus;
  isFeatured: boolean;
  isRecommended: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  classificationConfidence: number | null; // Internal only

  // Pricing
  pricePkr: number;
  actualPrice: number;
  salePrice: number | null;
  discountPercentage: number | null;
  discountType: string | null;
  discountValue: number | null;
  isOnSale: boolean;

  // Media
  imageUrl: string;
  productUrl: string | null;

  // Inventory
  stock: number;
  isActive: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Relations
  brand?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
}

export interface ProductFilters {
  gender?: string[];
  department?: string[];
  category?: string[];
  subcategory?: string[];
  brandId?: string[];
  colors?: string[];
  sizes?: string[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  availabilityStatus?: string[];
  isFeatured?: boolean;
  fit?: string[];
  material?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'name';
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface BrandOption {
  id: string;
  name: string;
  count: number;
}

export interface AvailableFilters {
  availableGenders: FilterOption[];
  availableDepartments: FilterOption[];
  availableCategories: FilterOption[];
  availableSubcategories: FilterOption[];
  availableBrands: BrandOption[];
  availableSizes: Array<{ value: string; count: number }>;
  availableColors: Array<{ value: string; count: number }>;
  availableFits?: Array<{ value: string; count: number }>;
  availableMaterials?: Array<{ value: string; count: number }>;
  priceRange: { min: number; max: number };
  totalCount: number;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters?: AvailableFilters;
}

export interface ClassificationReview {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  brand: {
    id: string;
    name: string;
  };
  classification: {
    gender: string;
    department: string;
    category: string;
    subcategory: string | null;
    confidence: number | null;
  };
  formattedClassification: {
    gender: string;
    department: string;
    category: string;
    subcategory: string | null;
  };
  brandCategoryRaw: string | null;
  brandSubcategoryRaw: string | null;
  createdAt: Date;
}

export interface EnumOption {
  value: string;
  label: string;
}

export interface TaxonomyEnums {
  genders: EnumOption[];
  departments: EnumOption[];
  categories: EnumOption[];
  subcategories: EnumOption[];
  availabilityStatuses: EnumOption[];
}

/**
 * Format enum value for display
 */
export function formatEnumForDisplay(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get subcategory label based on category
 */
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
