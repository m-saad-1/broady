import type { Product } from "@/types/marketplace";
import { getBroadyDivisionForCategory } from "@broady/shared";

type ProductType = NonNullable<Product["productType"]>;

const genericProductTypeLabels: Record<ProductType, string> = {
  Top: "Shirts",
  Bottom: "Pants",
  Footwear: "Sneakers",
  Accessories: "Bags",
};

const subCategoryDisplayMap: Record<string, string> = {
  "T-Shirts": "Shirts",
  "Formal Shirts": "Shirts",
  "V-Neck": "Shirts",
  "Hoodies": "Shirts",
  "Sweatshirts": "Shirts",
  "Polo Shirts": "Polo",
  "Cargo Pants": "Pants",
  Trousers: "Pants",
  Joggers: "Pants",
  Jeans: "Jeans",
  Sneakers: "Sneakers",
  Trainers: "Sneakers",
  Shoes: "Shoes",
  Flats: "Flats",
  Boots: "Boots",
  "Slip Ons": "Slip Ons",
  Loafers: "Loafers",
  Pumps: "Pumps",
  Sandals: "Sandals",
  Dresses: "Dresses",
  Skirts: "Skirts",
  Bags: "Bags",
  Jewelry: "Jewelry",
  Socks: "Socks",
};

const displayCategoryToApiCategoryMap: Record<string, string> = {
  Shirts: "SHIRTS",
  "T-Shirts": "T_SHIRTS",
  Polo: "POLOS",
  Hoodies: "HOODIES",
  Sweatshirts: "SWEATSHIRTS",
  Jackets: "JACKETS",
  Sweaters: "SWEATERS",
  Vests: "VESTS",
  Blouses: "BLOUSES",
  Tops: "TOPS",
  Kurtas: "KURTAS",
  Trousers: "TROUSERS",
  Pants: "PANTS",
  Jeans: "JEANS",
  Shorts: "SHORTS",
  Skirts: "SKIRTS",
  Joggers: "JOGGERS",
  "Cargo Pants": "CARGO_PANTS",
  Sneakers: "SNEAKERS",
  Trainers: "TRAINERS",
  Loafers: "LOAFERS",
  Sandals: "SANDALS",
  Slippers: "SLIPPERS",
  Boots: "BOOTS",
  Shoes: "CLOSED_SHOE",
  "Formal Shoes": "FORMAL_SHOE",
  "Open Shoes": "OPEN_SHOE",
  Bags: "BAGS",
  Caps: "CAPS",
  Belts: "BELTS",
  Watches: "WATCHES",
  Wallets: "WALLETS",
  Socks: "SOCKS",
  Scarves: "SCARVES",
  Sunglasses: "SUNGLASSES",
  Jewelry: "JEWELLERY",
  Jewellery: "JEWELLERY",
};

const subCategoryToType: Record<string, ProductType> = {
  "T-Shirts": "Top",
  Polo: "Top",
  Shirts: "Top",
  "Polo Shirts": "Top",
  "V-Neck": "Top",
  "Formal Shirts": "Top",
  Hoodies: "Top",
  Sweatshirts: "Top",
  Jackets: "Top",
  Dresses: "Top",
  Bottom: "Bottom",
  Jeans: "Bottom",
  Trousers: "Bottom",
  Pants: "Bottom",
  Joggers: "Bottom",
  Shorts: "Bottom",
  "Cargo Pants": "Bottom",
  Skirts: "Bottom",
  Sneakers: "Footwear",
  Trainers: "Footwear",
  Shoes: "Footwear",
  Flats: "Footwear",
  Boots: "Footwear",
  "Slip Ons": "Footwear",
  Loafers: "Footwear",
  Pumps: "Footwear",
  Sandals: "Footwear",
  Bags: "Accessories",
  Belts: "Accessories",
  Caps: "Accessories",
  Watches: "Accessories",
  Jewelry: "Accessories",
  Socks: "Accessories",
};

const genericSubCategoryValues = new Set([
  "",
  "apparel",
  "clothing",
  "top",
  "bottom",
  "footwear",
  "accessories",
  "accessory",
  "other",
]);

const subCategoryAliasMap: Record<string, string> = {
  "t-shirt": "T-Shirts",
  "t-shirts": "T-Shirts",
  "t shirt": "T-Shirts",
  "t shirts": "T-Shirts",
  tshirt: "T-Shirts",
  tshirts: "T-Shirts",
  tee: "T-Shirts",
  tees: "T-Shirts",
  polo: "Polo",
  polos: "Polo",
  "polo shirt": "Polo",
  "polo shirts": "Polo",
  "casual shirt": "Shirts",
  "casual shirts": "Shirts",
  shirt: "Shirts",
  shirts: "Shirts",
  "formal shirt": "Formal Shirts",
  "formal shirts": "Formal Shirts",
  "v-neck": "V-Neck",
  vneck: "V-Neck",
  hoodie: "Hoodies",
  hoodies: "Hoodies",
  sweatshirt: "Hoodies",
  sweatshirts: "Hoodies",
  jacket: "Jackets",
  jackets: "Jackets",
  coat: "Jackets",
  coats: "Jackets",
  jeans: "Jeans",
  jean: "Jeans",
  denim: "Jeans",
  trouser: "Trousers",
  trousers: "Trousers",
  pant: "Pants",
  pants: "Pants",
  jogger: "Joggers",
  joggers: "Joggers",
  "cargo pants": "Cargo Pants",
  cargo: "Cargo Pants",
  short: "Shorts",
  shorts: "Shorts",
  skirt: "Skirts",
  skirts: "Skirts",
  dress: "Dresses",
  dresses: "Dresses",
  sneaker: "Sneakers",
  sneakers: "Sneakers",
  trainer: "Trainers",
  trainers: "Trainers",
  shoe: "Shoes",
  shoes: "Shoes",
  "open shoe": "Shoes",
  "open shoes": "Shoes",
  flat: "Flats",
  flats: "Flats",
  boot: "Boots",
  boots: "Boots",
  "slip ons": "Slip Ons",
  "slip-ons": "Slip Ons",
  loafer: "Loafers",
  loafers: "Loafers",
  sandal: "Sandals",
  sandals: "Sandals",
  pump: "Pumps",
  pumps: "Pumps",
  bag: "Bags",
  bags: "Bags",
  "bags & wallets": "Bags",
  "bags and wallets": "Bags",
  backpack: "Bags",
  backpacks: "Bags",
  tote: "Bags",
  totes: "Bags",
  belt: "Belts",
  belts: "Belts",
  cap: "Caps",
  caps: "Caps",
  hat: "Caps",
  hats: "Caps",
  watch: "Watches",
  watches: "Watches",
  jewelry: "Jewelry",
  jewellery: "Jewelry",
  necklace: "Jewelry",
  necklaces: "Jewelry",
  sock: "Socks",
  socks: "Socks",
};

function normalizeSubCategoryText(value?: string | null) {
  return (value || "")
    .trim()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeSubCategoryLabel(value?: string | null) {
  const cleaned = normalizeSubCategoryText(value);
  const normalized = cleaned.toLowerCase();
  if (genericSubCategoryValues.has(normalized)) return "";
  return subCategoryAliasMap[normalized] || cleaned;
}

function getObjectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    const objectValue = getObjectValue(current);
    if (!objectValue) return "";
    current = objectValue[segment];
  }

  return typeof current === "string" ? current : "";
}

function getMetadataProductType(product: Product) {
  const metadata = getObjectValue((product as Product & { metadata?: unknown }).metadata);
  if (!metadata) return "";

  const candidates = [
    getNestedString(metadata, ["product_type"]),
    getNestedString(metadata, ["productType"]),
    getNestedString(metadata, ["raw", "product_type"]),
    getNestedString(metadata, ["raw", "productType"]),
    getNestedString(metadata, ["raw", "raw", "product_type"]),
    getNestedString(metadata, ["raw", "raw", "productType"]),
    getNestedString(metadata, ["raw", "raw", "originalProductJson", "product_type"]),
    getNestedString(metadata, ["raw", "raw", "originalProductJson", "productType"]),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSubCategoryLabel(candidate);
    if (normalized) return normalized;
  }

  return "";
}

export function normalizeCatalogCategoryFilterValue(value?: string | null) {
  return normalizeSubCategoryLabel(value);
}

export function normalizeApiCategoryFilterValue(value?: string | null) {
  const normalized = normalizeCatalogCategoryFilterValue(value);
  return displayCategoryToApiCategoryMap[normalized] || normalized.toUpperCase().replace(/\s+/g, "_");
}

export const normalizeCatalogTypeFilterValue = normalizeCatalogCategoryFilterValue;

export function inferProductType(subCategory: string) {
  return subCategoryToType[subCategory] || "Top";
}

export function getCanonicalProductSubCategory(product: Product) {
  if (product.category) {
    return normalizeSubCategoryLabel(product.category);
  }
  const metadataProductType = getMetadataProductType(product);
  if (metadataProductType) return metadataProductType;

  const existing = normalizeSubCategoryLabel(product.subCategory);
  if (existing) return existing;

  return normalizeSubCategoryLabel((product as Product & { type?: string }).type || product.productType || "");
}

export function getTopCategoryLabel(category: string) {
  if (category === "Juniors") return "Boy/Girl";
  if (category === "Junior Boys" || category === "Toddler Boys") return "Boy";
  if (category === "Junior Girls" || category === "Toddler Girls") return "Girl";
  return category;
}

export function getProductDisplaySubCategory(product: Product) {
  const subCategory = product.subCategory?.trim() || "";

  if (!subCategory) {
    return genericProductTypeLabels[product.productType || inferProductType("T-Shirts")];
  }

  if (subCategory in genericProductTypeLabels) {
    return genericProductTypeLabels[subCategory as ProductType];
  }

  return subCategoryDisplayMap[subCategory] || subCategory;
}

export function getProductDisplayCategory(product: Product) {
  return `${getTopCategoryLabel(product.topCategory)} | ${getProductDisplaySubCategory(product)}`;
}

export function resolveTopCategoryFilter(category: string) {
  const normalized = category.trim().toLowerCase();

  if (normalized === "men") return "Men";
  if (normalized === "women") return "Women";
  if (normalized === "juniors" || normalized === "kids") return "Juniors";
  if (normalized === "boys") return "Junior Boys";
  if (normalized === "girls") return "Junior Girls";
  if (normalized === "toddler boys") return "Toddler Boys";
  if (normalized === "toddler girls") return "Toddler Girls";
  if (normalized === "junior boys") return "Junior Boys";
  if (normalized === "junior girls") return "Junior Girls";

  return category;
}

function stripHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/,|\/|\||;/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAdditionalInfo(value: unknown): Array<{ label: string; value: string }> {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const label = String(record.label || "").trim();
        const text = stripHtml(String(record.value || "")).trim();
        if (!label || !text) return null;
        return { label, value: text };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries
      .map(([key, raw]) => {
        const text = stripHtml(String(raw || "")).trim();
        if (!text) return null;
        return {
          label: key
            .replace(/[_-]+/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          value: text,
        };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;
  }

  return [];
}

export function normalizeProduct(product: Product): Product {
  const normalizedGender = product.normalizedGender || (["men", "women", "boys", "girls"].includes(String(product.gender).toLowerCase()) ? String(product.gender).toLowerCase() as Product["normalizedGender"] : undefined);
  const derivedTopCategory =
    normalizedGender === "men"
      ? "Men"
      : normalizedGender === "women"
        ? "Women"
        : normalizedGender === "boys"
          ? "Junior Boys"
          : normalizedGender === "girls"
            ? "Junior Girls"
            : product.topCategory;
  const rawType = (product as Product & { type?: string }).type;
  const normalizedRawType = (() => {
    if (!rawType) return undefined;

    const lower = rawType.toLowerCase();
    if (lower === "top") return "Top";
    if (lower === "bottom") return "Bottom";
    if (lower === "footwear") return "Footwear";
    if (lower === "accessories") return "Accessories";
    return undefined;
  })();
  const normalizedType =
    normalizedRawType ||
    (product.productType && ["Top", "Bottom", "Footwear", "Accessories"].includes(product.productType)
      ? product.productType
      : undefined);
  const subCategory = getCanonicalProductSubCategory(product) || "Other";
  const productType = normalizedType || product.productType || inferProductType(subCategory);
  const metadata =
    (product as Product & { metadata?: Record<string, unknown> }).metadata &&
    typeof (product as Product & { metadata?: Record<string, unknown> }).metadata === "object"
      ? ((product as Product & { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>)
      : {};
  const normalizedDescription = stripHtml(product.description || "");
  const normalizedDescriptionLong = product.descriptionLong ? stripHtml(product.descriptionLong) : "";

  const variantColors = Array.isArray(product.variants) ? product.variants.map((variant) => variant.color || "").filter(Boolean) : [];
  const explicitColors = toStringArray((product as Product & { colors?: string[] | string }).colors);
  const metadataColors = toStringArray(metadata.colors);
  const colorFallback = toStringArray(product.color);
  const colors = Array.from(new Set([...explicitColors, ...metadataColors, ...variantColors, ...colorFallback].map((entry) => entry.toLowerCase())))
    .map((normalized) =>
      [...explicitColors, ...metadataColors, ...variantColors, ...colorFallback].find((entry) => entry.toLowerCase() === normalized) || normalized,
    )
    .filter(Boolean);

  const fit = String((product as Product & { fit?: string }).fit || product.detail?.fitDetails || metadata.fit || "").trim() || undefined;
  const explicitAdditionalInfo = normalizeAdditionalInfo((product as Product & { additionalInfo?: unknown }).additionalInfo);
  const metadataAdditionalInfo = normalizeAdditionalInfo(metadata.additionalInfo);
  const additionalInfo = explicitAdditionalInfo.length ? explicitAdditionalInfo : metadataAdditionalInfo;

  const sizeGuide = product.sizeGuide
    ? {
        ...product.sizeGuide,
        imageUrl: product.sizeGuide.imageUrl || product.detail?.sizeGuideImageUrl || undefined,
        entries: Array.isArray(product.sizeGuide.entries) ? product.sizeGuide.entries : undefined,
        details: [
          ...(Array.isArray(product.sizeGuide.details) ? product.sizeGuide.details : []),
          product.detail?.sizeGuideText || "",
        ].map((entry) => stripHtml(String(entry || "")).trim()).filter(Boolean),
      }
    : product.detail?.sizeGuideImageUrl || product.detail?.sizeGuideText
      ? {
          imageUrl: product.detail.sizeGuideImageUrl || undefined,
          details: product.detail.sizeGuideText ? [stripHtml(product.detail.sizeGuideText)] : undefined,
        }
    : undefined;

  const descriptionLong =
    normalizedDescriptionLong ||
    stripHtml(product.shortDescription || "") ||
    `${normalizedDescription}\n\nCut in a structured silhouette with clean finishing, this piece is designed for everyday city dressing. Pair with tonal bottoms and minimal footwear for a complete monochrome edit.`;

  return {
    ...product,
    gender:
      normalizedGender === "men"
        ? "Men"
        : normalizedGender === "women"
          ? "Women"
          : normalizedGender === "boys" || normalizedGender === "girls"
            ? "Juniors"
            : product.gender,
    normalizedGender,
    juniorsGroup:
      normalizedGender === "boys"
        ? (product.juniorsGroup || "Junior Boys")
        : normalizedGender === "girls"
          ? (product.juniorsGroup || "Junior Girls")
          : product.juniorsGroup,
    topCategory: derivedTopCategory,
    division: product.division || getBroadyDivisionForCategory(product.category || "") || undefined,
    category: product.category || undefined,
    subType: product.subType || undefined,
    description: normalizedDescription || product.description,
    productType,
    subCategory,
    descriptionLong,
    colors: colors.length ? colors : undefined,
    fit,
    additionalInfo: additionalInfo.length ? additionalInfo : undefined,
    sizeGuide,
  };
}
