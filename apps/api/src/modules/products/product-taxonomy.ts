import {
  BROADY_CATEGORY_VALUES,
  BROADY_DIVISION_VALUES,
  BROADY_GENDER_VALUES,
  BROADY_MAPPING_STATUS_VALUES,
  BROADY_RESOLUTION_SOURCE_VALUES,
  BROADY_SUB_TYPE_CONFIDENCE_VALUES,
  BROADY_SUB_TYPES_BY_CATEGORY,
  type BroadyCategory,
  type BroadyDivision,
  type BroadyGender,
  type BroadyMappingStatus,
  type BroadyResolutionSource,
  type BroadySubType,
  type BroadySubTypeConfidence,
  getBroadyDivisionForCategory,
} from "@broady/shared";

type TaxonomyResolutionInput = {
  brandSlug?: string | null;
  name?: string | null;
  rawGender?: string | null;
  rawTopCategory?: string | null;
  rawCategory?: string | null;
  rawSubCategory?: string | null;
  productUrl?: string | null;
  breadcrumb?: string[] | null;
  sizes?: string[] | null;
};

export type ResolvedBroadyTaxonomy = {
  gender: BroadyGender | null;
  division: BroadyDivision | null;
  category: BroadyCategory | null;
  subType: BroadySubType | null;
  subTypeConfidence: BroadySubTypeConfidence;
  mappingStatus: BroadyMappingStatus;
  resolutionSource: BroadyResolutionSource;
  pageContext: Record<string, unknown>;
  topCategory: string;
  legacyProductType: "Top" | "Bottom" | "Footwear" | "Accessories";
  legacySubCategory: string;
};

const CATEGORY_ALIAS_MAP: Record<string, BroadyCategory> = {
  shirt: "shirt",
  shirts: "shirt",
  "formal shirt": "shirt",
  "formal shirts": "shirt",
  overshirt: "shirt",
  "t-shirt": "t-shirt",
  "t-shirts": "t-shirt",
  "t shirt": "t-shirt",
  "t shirts": "t-shirt",
  tshirt: "t-shirt",
  tshirts: "t-shirt",
  tee: "t-shirt",
  tees: "t-shirt",
  polo: "polo",
  polos: "polo",
  "polo shirt": "polo",
  "polo shirts": "polo",
  hoodie: "hoodie",
  hoodies: "hoodie",
  sweatshirt: "sweatshirt",
  sweatshirts: "sweatshirt",
  activewear: "sweatshirt",
  jacket: "jacket",
  jackets: "jacket",
  coat: "coat",
  coats: "coat",
  sweater: "sweater",
  sweaters: "sweater",
  vest: "vest",
  vests: "vest",
  blouse: "blouse",
  blouses: "blouse",
  top: "top",
  tops: "top",
  kurta: "kurta",
  kurtas: "kurta",
  trouser: "trouser",
  trousers: "trouser",
  pant: "pant",
  pants: "pant",
  chino: "pant",
  chinos: "pant",
  jean: "jeans",
  jeans: "jeans",
  short: "shorts",
  shorts: "shorts",
  skirt: "skirt",
  skirts: "skirt",
  jogger: "jogger",
  joggers: "jogger",
  cargo: "cargo",
  cargos: "cargo",
  "cargo pants": "cargo",
  sneaker: "sneaker",
  sneakers: "sneaker",
  trainer: "trainer",
  trainers: "trainer",
  loafer: "loafer",
  loafers: "loafer",
  sandal: "sandal",
  sandals: "sandal",
  slipper: "slipper",
  slippers: "slipper",
  boot: "boot",
  boots: "boot",
  shoe: "closed_shoe",
  shoes: "closed_shoe",
  footwear: "closed_shoe",
  "formal shoe": "formal_shoe",
  "formal shoes": "formal_shoe",
  "open shoe": "open_shoe",
  "open shoes": "open_shoe",
  "closed shoe": "closed_shoe",
  "closed shoes": "closed_shoe",
  bag: "bag",
  bags: "bag",
  backpack: "bag",
  backpacks: "bag",
  tote: "bag",
  totes: "bag",
  cap: "cap",
  caps: "cap",
  hat: "cap",
  hats: "cap",
  belt: "belt",
  belts: "belt",
  watch: "watch",
  watches: "watch",
  wallet: "wallet",
  wallets: "wallet",
  sock: "socks",
  socks: "socks",
  scarf: "scarf",
  scarves: "scarf",
  sunglass: "sunglasses",
  sunglasses: "sunglasses",
  jewelry: "jewellery",
  jewellery: "jewellery",
  underwear: "underwear",
  boxer: "underwear",
  boxers: "underwear",
  brief: "underwear",
  briefs: "underwear",
};

const SUB_TYPE_ALIAS_MAP: Record<string, BroadySubType> = {
  basic: "basic",
  knit: "knit",
  embedded: "embedded",
  embroidered: "embedded",
  textured: "textured",
  printed: "printed",
  denim: "denim",
  flannel: "flannel",
  linen: "linen",
  formal: "formal",
  casual: "casual",
  pique: "pique",
  striped: "striped",
  graphic: "graphic",
  oversized: "oversized",
  pullover: "pullover",
  "zip-up": "zip-up",
  zipup: "zip-up",
  "low-top": "low-top",
  lowtop: "low-top",
  "high-top": "high-top",
  hightop: "high-top",
  chunky: "chunky",
  "slip-on": "slip-on",
  slipon: "slip-on",
  running: "running",
  leather: "leather",
  bomber: "bomber",
  windbreaker: "windbreaker",
  quilted: "quilted",
  boxer: "boxer",
  boxers: "boxer",
  brief: "brief",
  briefs: "brief",
};

const DIVISION_TO_LEGACY_TYPE: Record<BroadyDivision, "Top" | "Bottom" | "Footwear" | "Accessories"> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Footwear",
  accessory: "Accessories",
};

const CATEGORY_TO_LEGACY_SUBCATEGORY: Partial<Record<BroadyCategory, string>> = {
  shirt: "Shirts",
  "t-shirt": "T-Shirts",
  polo: "Polo",
  hoodie: "Hoodies",
  sweatshirt: "Sweatshirts",
  jacket: "Jackets",
  coat: "Jackets",
  sweater: "Sweaters",
  vest: "Vests",
  blouse: "Blouses",
  top: "Tops",
  kurta: "Kurtas",
  trouser: "Trousers",
  pant: "Pants",
  jeans: "Jeans",
  shorts: "Shorts",
  skirt: "Skirts",
  jogger: "Joggers",
  cargo: "Cargo Pants",
  sneaker: "Sneakers",
  trainer: "Trainers",
  loafer: "Loafers",
  sandal: "Sandals",
  slipper: "Slippers",
  boot: "Boots",
  formal_shoe: "Formal Shoes",
  open_shoe: "Open Shoes",
  closed_shoe: "Shoes",
  bag: "Bags",
  cap: "Caps",
  belt: "Belts",
  watch: "Watches",
  wallet: "Wallets",
  socks: "Socks",
  scarf: "Scarves",
  sunglasses: "Sunglasses",
  jewellery: "Jewellery",
  underwear: "Underwear",
};

function normalizeToken(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

function titleize(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseUrlSegments(productUrl?: string | null) {
  if (!productUrl) return [];
  try {
    const url = new URL(productUrl);
    return url.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment).trim())
      .filter(Boolean);
  } catch {
    return String(productUrl)
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
}

function normalizeGender(rawValue?: string | null, urlSegments: string[] = [], breadcrumb: string[] = [], title = "", sizes: string[] = []): BroadyGender | null {
  const candidates = [rawValue, ...urlSegments, ...breadcrumb, title, ...sizes];
  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);
    if (!normalized) continue;
    if (/\bmen\b|\bman\b|\bmale\b/.test(normalized)) return "men";
    if (/\bwomen\b|\bwoman\b|\bfemale\b/.test(normalized)) return "women";
    if (/\bboys\b|\bboy\b|\bjunior boys\b|\btoddler boys\b/.test(normalized)) return "boys";
    if (/\bgirls\b|\bgirl\b|\bjunior girls\b|\btoddler girls\b/.test(normalized)) return "girls";
    if (/\bunisex\b/.test(normalized)) return "unisex";
  }
  return null;
}

function normalizeCategory(rawValue?: string | null, title?: string | null): BroadyCategory | null {
  const candidates = [rawValue, title];
  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);
    if (!normalized) continue;
    if (CATEGORY_ALIAS_MAP[normalized]) {
      return CATEGORY_ALIAS_MAP[normalized];
    }
    for (const [alias, category] of Object.entries(CATEGORY_ALIAS_MAP)) {
      const regex = new RegExp(`\\b${alias}\\b`, 'i');
      if (regex.test(normalized)) {
        return category;
      }
    }
  }
  return null;
}

function normalizeSubType(rawValue?: string | null, title?: string | null, category?: BroadyCategory | null) {
  const candidates = [rawValue, title];
  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);
    if (!normalized) continue;
    const matched =
      SUB_TYPE_ALIAS_MAP[normalized] ||
      Object.entries(SUB_TYPE_ALIAS_MAP).find(([alias]) => new RegExp(`\\b${alias}\\b`, 'i').test(normalized))?.[1];
    if (!matched) continue;
    if (category) {
      const allowed = BROADY_SUB_TYPES_BY_CATEGORY[category];
      if (allowed?.includes(matched)) {
        return matched;
      }
      continue;
    }
    return matched;
  }
  return null;
}

function resolveTopCategory(gender: BroadyGender | null) {
  if (gender === "men") return "Men";
  if (gender === "women") return "Women";
  if (gender === "boys") return "Junior Boys";
  if (gender === "girls") return "Junior Girls";
  return "Unisex";
}

export function resolveBroadyTaxonomy(input: TaxonomyResolutionInput): ResolvedBroadyTaxonomy {
  const title = (input.name || "").trim();
  const urlSegments = parseUrlSegments(input.productUrl);
  const breadcrumb = Array.isArray(input.breadcrumb) ? input.breadcrumb.filter(Boolean) : [];
  const normalizedBreadcrumb = breadcrumb.map((entry) => String(entry));
  const genderRaw = input.rawGender || input.rawTopCategory || urlSegments[0] || normalizedBreadcrumb[0] || null;
  const categoryRaw =
    input.rawCategory ||
    input.rawSubCategory ||
    urlSegments.find((segment) => CATEGORY_ALIAS_MAP[normalizeToken(segment)]) ||
    normalizedBreadcrumb.find((segment) => CATEGORY_ALIAS_MAP[normalizeToken(segment)]) ||
    null;
  const subTypeRaw =
    input.rawSubCategory ||
    urlSegments.find((segment) => SUB_TYPE_ALIAS_MAP[normalizeToken(segment)]) ||
    normalizedBreadcrumb.find((segment) => SUB_TYPE_ALIAS_MAP[normalizeToken(segment)]) ||
    null;

  const gender = normalizeGender(genderRaw, urlSegments, normalizedBreadcrumb, title, input.sizes || []);
  const category = normalizeCategory(categoryRaw, title);
  const division = category ? getBroadyDivisionForCategory(category) || null : null;
  let subType = normalizeSubType(subTypeRaw, title, category);
  let resolutionSource: BroadyResolutionSource = "unresolved";
  let subTypeConfidence: BroadySubTypeConfidence = "null";

  if (subType) {
    const normalizedSubTypeRaw = normalizeToken(subTypeRaw);
    const titleSourceUsed = title && (!normalizedSubTypeRaw || !normalizeToken(title).includes(normalizedSubTypeRaw));
    subTypeConfidence = titleSourceUsed ? "inferred" : "explicit";
    resolutionSource = normalizedSubTypeRaw ? "url_and_breadcrumb" : "title_keyword";
  }

  if (!subType && category && BROADY_SUB_TYPES_BY_CATEGORY[category]?.length) {
    subTypeConfidence = "null";
  }

  if (!subType && category && !BROADY_SUB_TYPES_BY_CATEGORY[category]?.length) {
    resolutionSource = categoryRaw ? "adapter_label" : "unresolved";
  }

  if (!subType && category && BROADY_SUB_TYPES_BY_CATEGORY[category]?.length) {
    resolutionSource = categoryRaw ? "adapter_label" : "unresolved";
  }

  const mappingStatus: BroadyMappingStatus =
    !gender || !division || !category
      ? "unresolved"
      : BROADY_SUB_TYPES_BY_CATEGORY[category]?.length && !subType
        ? "partial"
        : "complete";

  if (mappingStatus === "unresolved") {
    resolutionSource = "unresolved";
  } else if (resolutionSource === "unresolved") {
    resolutionSource = urlSegments.length && normalizedBreadcrumb.length ? "url_and_breadcrumb" : urlSegments.length ? "url_only" : normalizedBreadcrumb.length ? "breadcrumb_only" : "adapter_label";
  }

  if (category && subType && !BROADY_SUB_TYPES_BY_CATEGORY[category]?.includes(subType)) {
    subType = null;
    subTypeConfidence = "null";
  }

  const topCategory = resolveTopCategory(gender);
  const legacyProductType = division ? DIVISION_TO_LEGACY_TYPE[division] : "Top";
  const legacySubCategory = (category && CATEGORY_TO_LEGACY_SUBCATEGORY[category]) || titleize(input.rawSubCategory || input.rawCategory || "Other");

  return {
    gender,
    division,
    category,
    subType,
    subTypeConfidence,
    mappingStatus,
    resolutionSource,
    pageContext: {
      scrapeUrl: input.productUrl || null,
      urlSegments,
      breadcrumbRaw: normalizedBreadcrumb,
      genderRaw,
      categoryRaw,
      subTypeRaw,
      resolvedGender: gender,
      resolvedDivision: division,
      resolvedCategory: category,
      resolvedSubType: subType,
      resolutionSource,
      brandSlug: input.brandSlug || null,
    },
    topCategory,
    legacyProductType,
    legacySubCategory,
  };
}

export function isValidBroadyTaxonomyValueSet() {
  return (
    BROADY_GENDER_VALUES.length > 0 &&
    BROADY_DIVISION_VALUES.length > 0 &&
    BROADY_CATEGORY_VALUES.length > 0 &&
    BROADY_MAPPING_STATUS_VALUES.length > 0 &&
    BROADY_RESOLUTION_SOURCE_VALUES.length > 0 &&
    BROADY_SUB_TYPE_CONFIDENCE_VALUES.length > 0
  );
}
