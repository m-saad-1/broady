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
  "Polo Shirts": "Top",
  "V-Neck": "Top",
  "Formal Shirts": "Top",
  "Hoodies": "Top",
  "Sweatshirts": "Top",
  Clothing: "Top",
  Outerwear: "Top",
  Dresses: "Top",
  Jeans: "Bottom",
  Trousers: "Bottom",
  Joggers: "Bottom",
  "Cargo Pants": "Bottom",
  "Skirts": "Bottom",
  "Slip Ons": "Footwear",
  Sneakers: "Footwear",
  Boots: "Footwear",
  Sandals: "Footwear",
  Loafers: "Footwear",
  Footwear: "Footwear",
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
  return category.toLowerCase() === "kids" ? "Juniors" : category;
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

  if (normalized === "juniors" || normalized === "kids") return "Kids";
  if (normalized === "men") return "Men";
  if (normalized === "women") return "Women";

  return category;
}

export function normalizeProduct(product: Product): Product {
  const productType = product.productType || inferProductType(product.subCategory || "T-Shirts");
  const subCategory = product.subCategory || "T-Shirts";
  const colors = product.colors && product.colors.length ? product.colors : ["Black", "White", "Graphite"];
  const descriptionLong =
    product.descriptionLong ||
    `${product.description}\n\nCut in a structured silhouette with clean finishing, this piece is designed for everyday city dressing. Pair with tonal bottoms and minimal footwear for a complete monochrome edit.`;

  return {
    ...product,
    productType,
    subCategory,
    colors,
    descriptionLong,
  };
}
