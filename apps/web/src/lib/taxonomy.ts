import type { Product } from "@/types/marketplace";

type ProductType = NonNullable<Product["productType"]>;

const genericProductTypeLabels: Record<ProductType, string> = {
  Top: "Shirts",
  Bottom: "Pants",
  Footwear: "Shoes",
  Accessories: "Accessories",
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
  Sneakers: "Shoes",
  Boots: "Shoes",
  Sandals: "Shoes",
  Loafers: "Shoes",
  "Slip Ons": "Shoes",
  Dresses: "Dresses",
  Skirts: "Skirts",
};

const subCategoryToType: Record<string, ProductType> = {
  "T-Shirts": "Top",
  Shirts: "Top",
  "Polo Shirts": "Top",
  "V-Neck": "Top",
  "Formal Shirts": "Top",
  "Hoodies": "Top",
  "Sweatshirts": "Top",
  Clothing: "Top",
  Outerwear: "Top",
  Dresses: "Top",
  Bottom: "Bottom",
  Jeans: "Bottom",
  Trousers: "Bottom",
  Joggers: "Bottom",
  Shorts: "Bottom",
  "Cargo Pants": "Bottom",
  "Skirts": "Bottom",
  Derby: "Footwear",
  "Slip Ons": "Footwear",
  Sneakers: "Footwear",
  Boots: "Footwear",
  Sandals: "Footwear",
  Loafers: "Footwear",
  Footwear: "Footwear",
  Socks: "Accessories",
  Bags: "Accessories",
  Belts: "Accessories",
  Caps: "Accessories",
  Jewelry: "Accessories",
  Accessories: "Accessories",
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
  const descriptionLong =
    product.descriptionLong ||
    `${product.description}\n\nCut in a structured silhouette with clean finishing, this piece is designed for everyday city dressing. Pair with tonal bottoms and minimal footwear for a complete monochrome edit.`;

  return {
    ...product,
    productType,
    subCategory,
    descriptionLong,
  };
}
