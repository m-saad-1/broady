/**
 * Broady Product Taxonomy System
 *
 * This module defines the universal product taxonomy that normalizes
 * all brand-specific categories into a consistent classification system.
 *
 * Brand Taxonomy ≠ Broady Taxonomy
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
  UNDERWEAR = 'UNDERWEAR',
}

export enum Subcategory {
  TEXTURED_SHIRT = 'TEXTURED_SHIRT',
  EMBROIDERED_SHIRT = 'EMBROIDERED_SHIRT',
  KNIT_SHIRT = 'KNIT_SHIRT',
  PRINTED_SHIRT = 'PRINTED_SHIRT',
  FORMAL_SHIRT = 'FORMAL_SHIRT',
  CASUAL_SHIRT = 'CASUAL_SHIRT',
  DENIM_SHIRT = 'DENIM_SHIRT',
  FLANNEL_SHIRT = 'FLANNEL_SHIRT',
  OXFORD_SHIRT = 'OXFORD_SHIRT',
  LINEN_SHIRT = 'LINEN_SHIRT',
  GRAPHIC_TSHIRT = 'GRAPHIC_TSHIRT',
  PLAIN_TSHIRT = 'PLAIN_TSHIRT',
  OVERSIZED_TSHIRT = 'OVERSIZED_TSHIRT',
  HENLEY_TSHIRT = 'HENLEY_TSHIRT',
  V_NECK_TSHIRT = 'V_NECK_TSHIRT',
  CREW_NECK_TSHIRT = 'CREW_NECK_TSHIRT',
  POCKET_TSHIRT = 'POCKET_TSHIRT',
  STRIPED_TSHIRT = 'STRIPED_TSHIRT',
  PIQUE_POLO = 'PIQUE_POLO',
  TIPPED_POLO = 'TIPPED_POLO',
  CLASSIC_POLO = 'CLASSIC_POLO',
  PERFORMANCE_POLO = 'PERFORMANCE_POLO',
  SLIM_FIT_JEANS = 'SLIM_FIT_JEANS',
  REGULAR_FIT_JEANS = 'REGULAR_FIT_JEANS',
  RELAXED_FIT_JEANS = 'RELAXED_FIT_JEANS',
  SKINNY_JEANS = 'SKINNY_JEANS',
  STRAIGHT_LEG_JEANS = 'STRAIGHT_LEG_JEANS',
  BOOTCUT_JEANS = 'BOOTCUT_JEANS',
  DISTRESSED_JEANS = 'DISTRESSED_JEANS',
  DARK_WASH_JEANS = 'DARK_WASH_JEANS',
  LIGHT_WASH_JEANS = 'LIGHT_WASH_JEANS',
  RAW_DENIM_JEANS = 'RAW_DENIM_JEANS',
  CHINO_TROUSERS = 'CHINO_TROUSERS',
  DRESS_TROUSERS = 'DRESS_TROUSERS',
  PLEATED_TROUSERS = 'PLEATED_TROUSERS',
  FLAT_FRONT_TROUSERS = 'FLAT_FRONT_TROUSERS',
  CARGO_SHORTS = 'CARGO_SHORTS',
  DENIM_SHORTS = 'DENIM_SHORTS',
  CHINO_SHORTS = 'CHINO_SHORTS',
  ATHLETIC_SHORTS = 'ATHLETIC_SHORTS',
  SWIM_SHORTS = 'SWIM_SHORTS',
  ZIP_HOODIE = 'ZIP_HOODIE',
  PULLOVER_HOODIE = 'PULLOVER_HOODIE',
  GRAPHIC_HOODIE = 'GRAPHIC_HOODIE',
  FLEECE_HOODIE = 'FLEECE_HOODIE',
  BOMBER_JACKET = 'BOMBER_JACKET',
  DENIM_JACKET = 'DENIM_JACKET',
  LEATHER_JACKET = 'LEATHER_JACKET',
  WINDBREAKER = 'WINDBREAKER',
  PUFFER_JACKET = 'PUFFER_JACKET',
  VARSITY_JACKET = 'VARSITY_JACKET',
  RUNNING_SNEAKER = 'RUNNING_SNEAKER',
  LIFESTYLE_SNEAKER = 'LIFESTYLE_SNEAKER',
  TRAINING_SNEAKER = 'TRAINING_SNEAKER',
  CASUAL_SNEAKER = 'CASUAL_SNEAKER',
  HIGH_TOP_SNEAKER = 'HIGH_TOP_SNEAKER',
  LOW_TOP_SNEAKER = 'LOW_TOP_SNEAKER',
  CANVAS_SNEAKER = 'CANVAS_SNEAKER',
  SLIP_ON_SNEAKER = 'SLIP_ON_SNEAKER',
  FORMAL_LOAFER = 'FORMAL_LOAFER',
  CASUAL_LOAFER = 'CASUAL_LOAFER',
  PENNY_LOAFER = 'PENNY_LOAFER',
  TASSEL_LOAFER = 'TASSEL_LOAFER',
  SLIDE_SANDAL = 'SLIDE_SANDAL',
  FLIP_FLOP_SANDAL = 'FLIP_FLOP_SANDAL',
  SPORT_SANDAL = 'SPORT_SANDAL',
  GLADIATOR_SANDAL = 'GLADIATOR_SANDAL',
  BASEBALL_CAP = 'BASEBALL_CAP',
  SNAPBACK_CAP = 'SNAPBACK_CAP',
  FITTED_CAP = 'FITTED_CAP',
  TRUCKER_CAP = 'TRUCKER_CAP',
  BEANIE = 'BEANIE',
  BUCKET_HAT = 'BUCKET_HAT',
  BACKPACK = 'BACKPACK',
  MESSENGER_BAG = 'MESSENGER_BAG',
  TOTE_BAG = 'TOTE_BAG',
  DUFFLE_BAG = 'DUFFLE_BAG',
  CROSSBODY_BAG = 'CROSSBODY_BAG',
  CLUTCH = 'CLUTCH',
  LEATHER_BELT = 'LEATHER_BELT',
  CANVAS_BELT = 'CANVAS_BELT',
  BRAIDED_BELT = 'BRAIDED_BELT',
  REVERSIBLE_BELT = 'REVERSIBLE_BELT',
  DRESS_SOCKS = 'DRESS_SOCKS',
  ATHLETIC_SOCKS = 'ATHLETIC_SOCKS',
  ANKLE_SOCKS = 'ANKLE_SOCKS',
  NO_SHOW_SOCKS = 'NO_SHOW_SOCKS',
  BOXERS = 'BOXERS',
  BRIEFS = 'BRIEFS',
}

export enum AvailabilityStatus {
  IN_STOCK = 'IN_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  PREORDER = 'PREORDER',
  DISCONTINUED = 'DISCONTINUED',
}

/**
 * Category to ProductType mapping
 * Backend-only, not exposed to users
 */
export const CATEGORY_TO_PRODUCT_TYPE: Record<Category, ProductType> = {
  [Category.SHIRTS]: ProductType.TOP,
  [Category.T_SHIRTS]: ProductType.TOP,
  [Category.POLOS]: ProductType.TOP,
  [Category.HOODIES]: ProductType.TOP,
  [Category.JACKETS]: ProductType.TOP,
  [Category.SWEATSHIRTS]: ProductType.TOP,
  [Category.KURTAS]: ProductType.TOP,
  [Category.SHALWAR_KAMEEZ]: ProductType.TOP,
  [Category.WAISTCOATS]: ProductType.TOP,
  [Category.BLAZERS]: ProductType.TOP,
  [Category.COATS]: ProductType.TOP,
  [Category.SWEATERS]: ProductType.TOP,
  [Category.CARDIGANS]: ProductType.TOP,
  [Category.VESTS]: ProductType.TOP,
  [Category.TANK_TOPS]: ProductType.TOP,
  [Category.DRESSES]: ProductType.TOP,
  [Category.JEANS]: ProductType.BOTTOM,
  [Category.TROUSERS]: ProductType.BOTTOM,
  [Category.SHORTS]: ProductType.BOTTOM,
  [Category.JOGGERS]: ProductType.BOTTOM,
  [Category.CARGO_PANTS]: ProductType.BOTTOM,
  [Category.FORMAL_PANTS]: ProductType.BOTTOM,
  [Category.CHINOS]: ProductType.BOTTOM,
  [Category.SKIRTS]: ProductType.BOTTOM,
  [Category.LEGGINGS]: ProductType.BOTTOM,
  [Category.SNEAKERS]: ProductType.FOOTWEAR,
  [Category.LOAFERS]: ProductType.FOOTWEAR,
  [Category.SANDALS]: ProductType.FOOTWEAR,
  [Category.BOOTS]: ProductType.FOOTWEAR,
  [Category.FLATS]: ProductType.FOOTWEAR,
  [Category.HEELS]: ProductType.FOOTWEAR,
  [Category.SLIPPERS]: ProductType.FOOTWEAR,
  [Category.CAPS]: ProductType.ACCESSORY,
  [Category.BAGS]: ProductType.ACCESSORY,
  [Category.BELTS]: ProductType.ACCESSORY,
  [Category.SOCKS]: ProductType.ACCESSORY,
  [Category.WATCHES]: ProductType.ACCESSORY,
  [Category.SUNGLASSES]: ProductType.ACCESSORY,
  [Category.WALLETS]: ProductType.ACCESSORY,
  [Category.SCARVES]: ProductType.ACCESSORY,
  [Category.TIES]: ProductType.ACCESSORY,
  [Category.UNDERWEAR]: ProductType.BOTTOM,
};

/**
 * Category to Department mapping
 */
export const CATEGORY_TO_DEPARTMENT: Record<Category, Department> = {
  [Category.SHIRTS]: Department.CLOTHING,
  [Category.T_SHIRTS]: Department.CLOTHING,
  [Category.POLOS]: Department.CLOTHING,
  [Category.HOODIES]: Department.CLOTHING,
  [Category.JACKETS]: Department.CLOTHING,
  [Category.SWEATSHIRTS]: Department.CLOTHING,
  [Category.JEANS]: Department.CLOTHING,
  [Category.TROUSERS]: Department.CLOTHING,
  [Category.SHORTS]: Department.CLOTHING,
  [Category.JOGGERS]: Department.CLOTHING,
  [Category.CARGO_PANTS]: Department.CLOTHING,
  [Category.FORMAL_PANTS]: Department.CLOTHING,
  [Category.CHINOS]: Department.CLOTHING,
  [Category.KURTAS]: Department.CLOTHING,
  [Category.SHALWAR_KAMEEZ]: Department.CLOTHING,
  [Category.WAISTCOATS]: Department.CLOTHING,
  [Category.BLAZERS]: Department.CLOTHING,
  [Category.COATS]: Department.CLOTHING,
  [Category.SWEATERS]: Department.CLOTHING,
  [Category.CARDIGANS]: Department.CLOTHING,
  [Category.VESTS]: Department.CLOTHING,
  [Category.TANK_TOPS]: Department.CLOTHING,
  [Category.DRESSES]: Department.CLOTHING,
  [Category.SKIRTS]: Department.CLOTHING,
  [Category.LEGGINGS]: Department.CLOTHING,
  [Category.SNEAKERS]: Department.FOOTWEAR,
  [Category.LOAFERS]: Department.FOOTWEAR,
  [Category.SANDALS]: Department.FOOTWEAR,
  [Category.BOOTS]: Department.FOOTWEAR,
  [Category.FLATS]: Department.FOOTWEAR,
  [Category.HEELS]: Department.FOOTWEAR,
  [Category.SLIPPERS]: Department.FOOTWEAR,
  [Category.CAPS]: Department.ACCESSORIES,
  [Category.BAGS]: Department.ACCESSORIES,
  [Category.BELTS]: Department.ACCESSORIES,
  [Category.SOCKS]: Department.ACCESSORIES,
  [Category.WATCHES]: Department.ACCESSORIES,
  [Category.SUNGLASSES]: Department.ACCESSORIES,
  [Category.WALLETS]: Department.ACCESSORIES,
  [Category.SCARVES]: Department.ACCESSORIES,
  [Category.TIES]: Department.ACCESSORIES,
  [Category.UNDERWEAR]: Department.CLOTHING,
};

/**
 * Subcategory to Category mapping
 */
export const SUBCATEGORY_TO_CATEGORY: Record<Subcategory, Category> = {
  [Subcategory.TEXTURED_SHIRT]: Category.SHIRTS,
  [Subcategory.EMBROIDERED_SHIRT]: Category.SHIRTS,
  [Subcategory.KNIT_SHIRT]: Category.SHIRTS,
  [Subcategory.PRINTED_SHIRT]: Category.SHIRTS,
  [Subcategory.FORMAL_SHIRT]: Category.SHIRTS,
  [Subcategory.CASUAL_SHIRT]: Category.SHIRTS,
  [Subcategory.DENIM_SHIRT]: Category.SHIRTS,
  [Subcategory.FLANNEL_SHIRT]: Category.SHIRTS,
  [Subcategory.OXFORD_SHIRT]: Category.SHIRTS,
  [Subcategory.LINEN_SHIRT]: Category.SHIRTS,
  [Subcategory.GRAPHIC_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.PLAIN_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.OVERSIZED_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.HENLEY_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.V_NECK_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.CREW_NECK_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.POCKET_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.STRIPED_TSHIRT]: Category.T_SHIRTS,
  [Subcategory.PIQUE_POLO]: Category.POLOS,
  [Subcategory.TIPPED_POLO]: Category.POLOS,
  [Subcategory.CLASSIC_POLO]: Category.POLOS,
  [Subcategory.PERFORMANCE_POLO]: Category.POLOS,
  [Subcategory.SLIM_FIT_JEANS]: Category.JEANS,
  [Subcategory.REGULAR_FIT_JEANS]: Category.JEANS,
  [Subcategory.RELAXED_FIT_JEANS]: Category.JEANS,
  [Subcategory.SKINNY_JEANS]: Category.JEANS,
  [Subcategory.STRAIGHT_LEG_JEANS]: Category.JEANS,
  [Subcategory.BOOTCUT_JEANS]: Category.JEANS,
  [Subcategory.DISTRESSED_JEANS]: Category.JEANS,
  [Subcategory.DARK_WASH_JEANS]: Category.JEANS,
  [Subcategory.LIGHT_WASH_JEANS]: Category.JEANS,
  [Subcategory.RAW_DENIM_JEANS]: Category.JEANS,
  [Subcategory.CHINO_TROUSERS]: Category.TROUSERS,
  [Subcategory.DRESS_TROUSERS]: Category.TROUSERS,
  [Subcategory.PLEATED_TROUSERS]: Category.TROUSERS,
  [Subcategory.FLAT_FRONT_TROUSERS]: Category.TROUSERS,
  [Subcategory.CARGO_SHORTS]: Category.SHORTS,
  [Subcategory.DENIM_SHORTS]: Category.SHORTS,
  [Subcategory.CHINO_SHORTS]: Category.SHORTS,
  [Subcategory.ATHLETIC_SHORTS]: Category.SHORTS,
  [Subcategory.SWIM_SHORTS]: Category.SHORTS,
  [Subcategory.ZIP_HOODIE]: Category.HOODIES,
  [Subcategory.PULLOVER_HOODIE]: Category.HOODIES,
  [Subcategory.GRAPHIC_HOODIE]: Category.HOODIES,
  [Subcategory.FLEECE_HOODIE]: Category.HOODIES,
  [Subcategory.BOMBER_JACKET]: Category.JACKETS,
  [Subcategory.DENIM_JACKET]: Category.JACKETS,
  [Subcategory.LEATHER_JACKET]: Category.JACKETS,
  [Subcategory.WINDBREAKER]: Category.JACKETS,
  [Subcategory.PUFFER_JACKET]: Category.JACKETS,
  [Subcategory.VARSITY_JACKET]: Category.JACKETS,
  [Subcategory.RUNNING_SNEAKER]: Category.SNEAKERS,
  [Subcategory.LIFESTYLE_SNEAKER]: Category.SNEAKERS,
  [Subcategory.TRAINING_SNEAKER]: Category.SNEAKERS,
  [Subcategory.CASUAL_SNEAKER]: Category.SNEAKERS,
  [Subcategory.HIGH_TOP_SNEAKER]: Category.SNEAKERS,
  [Subcategory.LOW_TOP_SNEAKER]: Category.SNEAKERS,
  [Subcategory.CANVAS_SNEAKER]: Category.SNEAKERS,
  [Subcategory.SLIP_ON_SNEAKER]: Category.SNEAKERS,
  [Subcategory.FORMAL_LOAFER]: Category.LOAFERS,
  [Subcategory.CASUAL_LOAFER]: Category.LOAFERS,
  [Subcategory.PENNY_LOAFER]: Category.LOAFERS,
  [Subcategory.TASSEL_LOAFER]: Category.LOAFERS,
  [Subcategory.SLIDE_SANDAL]: Category.SANDALS,
  [Subcategory.FLIP_FLOP_SANDAL]: Category.SANDALS,
  [Subcategory.SPORT_SANDAL]: Category.SANDALS,
  [Subcategory.GLADIATOR_SANDAL]: Category.SANDALS,
  [Subcategory.BASEBALL_CAP]: Category.CAPS,
  [Subcategory.SNAPBACK_CAP]: Category.CAPS,
  [Subcategory.FITTED_CAP]: Category.CAPS,
  [Subcategory.TRUCKER_CAP]: Category.CAPS,
  [Subcategory.BEANIE]: Category.CAPS,
  [Subcategory.BUCKET_HAT]: Category.CAPS,
  [Subcategory.BACKPACK]: Category.BAGS,
  [Subcategory.MESSENGER_BAG]: Category.BAGS,
  [Subcategory.TOTE_BAG]: Category.BAGS,
  [Subcategory.DUFFLE_BAG]: Category.BAGS,
  [Subcategory.CROSSBODY_BAG]: Category.BAGS,
  [Subcategory.CLUTCH]: Category.BAGS,
  [Subcategory.LEATHER_BELT]: Category.BELTS,
  [Subcategory.CANVAS_BELT]: Category.BELTS,
  [Subcategory.BRAIDED_BELT]: Category.BELTS,
  [Subcategory.REVERSIBLE_BELT]: Category.BELTS,
  [Subcategory.DRESS_SOCKS]: Category.SOCKS,
  [Subcategory.ATHLETIC_SOCKS]: Category.SOCKS,
  [Subcategory.ANKLE_SOCKS]: Category.SOCKS,
  [Subcategory.NO_SHOW_SOCKS]: Category.SOCKS,
  [Subcategory.BOXERS]: Category.UNDERWEAR,
  [Subcategory.BRIEFS]: Category.UNDERWEAR,
};

/**
 * Gender normalization map
 * Maps common brand gender labels to Broady Gender enum
 */
export const GENDER_NORMALIZATION_MAP: Record<string, Gender> = {
  // Men variations
  men: Gender.MEN,
  man: Gender.MEN,
  male: Gender.MEN,
  mens: Gender.MEN,
  "men's": Gender.MEN,
  gents: Gender.MEN,
  gentleman: Gender.MEN,

  // Women variations
  women: Gender.WOMEN,
  woman: Gender.WOMEN,
  female: Gender.WOMEN,
  womens: Gender.WOMEN,
  "women's": Gender.WOMEN,
  ladies: Gender.WOMEN,
  lady: Gender.WOMEN,

  // Boys variations
  boys: Gender.BOYS,
  boy: Gender.BOYS,
  "boy's": Gender.BOYS,
  kids_boys: Gender.BOYS,
  juniors_boys: Gender.BOYS,
  toddler_boys: Gender.BOYS,

  // Girls variations
  girls: Gender.GIRLS,
  girl: Gender.GIRLS,
  "girl's": Gender.GIRLS,
  kids_girls: Gender.GIRLS,
  juniors_girls: Gender.GIRLS,
  toddler_girls: Gender.GIRLS,

  // Unisex variations
  unisex: Gender.UNISEX,
  'uni-sex': Gender.UNISEX,
  all: Gender.UNISEX,
  everyone: Gender.UNISEX,
};

/**
 * Category keyword matching for AI classification
 */
export const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  [Category.SHIRTS]: ['shirt', 'button-up', 'button down', 'dress shirt', 'oxford', 'flannel', 'linen shirt'],
  [Category.T_SHIRTS]: ['t-shirt', 'tee', 'tshirt', 't shirt', 'graphic tee', 'plain tee'],
  [Category.POLOS]: ['polo', 'polo shirt', 'pique polo'],
  [Category.JEANS]: ['jeans', 'denim', 'jean pant'],
  [Category.TROUSERS]: ['trouser', 'pant', 'dress pant', 'formal pant', 'chino'],
  [Category.SHORTS]: ['short', 'bermuda', 'cargo short'],
  [Category.HOODIES]: ['hoodie', 'hoody', 'sweatshirt hood', 'pullover hood'],
  [Category.JACKETS]: ['jacket', 'coat', 'blazer', 'bomber', 'windbreaker', 'puffer'],
  [Category.SNEAKERS]: ['sneaker', 'trainer', 'running shoe', 'casual shoe', 'sports shoe'],
  [Category.LOAFERS]: ['loafer', 'slip-on', 'moccasin'],
  [Category.SANDALS]: ['sandal', 'flip-flop', 'slide', 'slipper'],
  [Category.CAPS]: ['cap', 'hat', 'beanie', 'snapback', 'baseball cap'],
  [Category.BAGS]: ['bag', 'backpack', 'tote', 'messenger', 'duffle'],
  [Category.BELTS]: ['belt'],
  [Category.SOCKS]: ['sock', 'socks'],
  [Category.SWEATSHIRTS]: ['sweatshirt', 'crew neck sweat'],
  [Category.JOGGERS]: ['jogger', 'track pant', 'sweatpant'],
  [Category.CARGO_PANTS]: ['cargo pant', 'cargo trouser'],
  [Category.FORMAL_PANTS]: ['formal pant', 'dress pant'],
  [Category.CHINOS]: ['chino'],
  [Category.KURTAS]: ['kurta', 'kurti'],
  [Category.SHALWAR_KAMEEZ]: ['shalwar', 'kameez', 'shalwar kameez'],
  [Category.WAISTCOATS]: ['waistcoat', 'vest'],
  [Category.BLAZERS]: ['blazer', 'suit jacket'],
  [Category.COATS]: ['coat', 'overcoat', 'trench'],
  [Category.SWEATERS]: ['sweater', 'pullover', 'jumper'],
  [Category.CARDIGANS]: ['cardigan'],
  [Category.VESTS]: ['vest', 'tank top vest'],
  [Category.TANK_TOPS]: ['tank top', 'singlet', 'muscle tee'],
  [Category.DRESSES]: ['dress', 'gown', 'frock'],
  [Category.SKIRTS]: ['skirt'],
  [Category.LEGGINGS]: ['legging', 'tight'],
  [Category.BOOTS]: ['boot', 'ankle boot', 'chelsea boot'],
  [Category.FLATS]: ['flat', 'ballet flat', 'flat shoe'],
  [Category.HEELS]: ['heel', 'high heel', 'pump', 'stiletto'],
  [Category.SLIPPERS]: ['slipper', 'house shoe'],
  [Category.WATCHES]: ['watch', 'wrist watch', 'timepiece'],
  [Category.SUNGLASSES]: ['sunglass', 'shades', 'eyewear'],
  [Category.WALLETS]: ['wallet', 'purse', 'card holder'],
  [Category.SCARVES]: ['scarf', 'shawl', 'muffler'],
  [Category.TIES]: ['tie', 'necktie', 'bow tie'],
  [Category.UNDERWEAR]: ['underwear', 'boxer', 'brief', 'panties', 'trunk', 'thong', 'bra', 'lingerie', 'boxers', 'undergarment'],
};

/**
 * Validation helpers
 */
export function isValidGender(value: string): value is Gender {
  return Object.values(Gender).includes(value as Gender);
}

export function isValidProductType(value: string): value is ProductType {
  return Object.values(ProductType).includes(value as ProductType);
}

export function isValidDepartment(value: string): value is Department {
  return Object.values(Department).includes(value as Department);
}

export function isValidCategory(value: string): value is Category {
  return Object.values(Category).includes(value as Category);
}

export function isValidSubcategory(value: string): value is Subcategory {
  return Object.values(Subcategory).includes(value as Subcategory);
}

/**
 * Get department from category
 */
export function getDepartmentFromCategory(category: Category): Department {
  return CATEGORY_TO_DEPARTMENT[category];
}

/**
 * Get product type from category
 */
export function getProductTypeFromCategory(category: Category): ProductType {
  return CATEGORY_TO_PRODUCT_TYPE[category];
}

/**
 * Get category from subcategory
 */
export function getCategoryFromSubcategory(subcategory: Subcategory): Category {
  return SUBCATEGORY_TO_CATEGORY[subcategory];
}

/**
 * Normalize gender string to Gender enum
 */
export function normalizeGender(input: string): Gender | null {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '_');
  return GENDER_NORMALIZATION_MAP[normalized] || null;
}

/**
 * Get subcategories for a category
 */
export function getSubcategoriesForCategory(category: Category): Subcategory[] {
  return Object.entries(SUBCATEGORY_TO_CATEGORY)
    .filter(([_, cat]) => cat === category)
    .map(([subcat]) => subcat as Subcategory);
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
