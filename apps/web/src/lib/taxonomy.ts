import type { Product } from "@/types/marketplace";

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
  Pumps: "Pumps",
  Sandals: "Sandals",
  Dresses: "Dresses",
  Skirts: "Skirts",
};

const subCategoryToType: Record<string, ProductType> = {
  "T-Shirts": "Top",
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
  Pumps: "Footwear",
  Sandals: "Footwear",
  Bags: "Accessories",
  Belts: "Accessories",
  Caps: "Accessories",
  Watches: "Accessories",
};

export function inferProductType(subCategory: string) {
  return subCategoryToType[subCategory] || "Top";
}

export function getTopCategoryLabel(category: string) {
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
  const productType = normalizedType || product.productType || inferProductType(product.subCategory || "T-Shirts");
  const subCategory = product.subCategory || "T-Shirts";
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
