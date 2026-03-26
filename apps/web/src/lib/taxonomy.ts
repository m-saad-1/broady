import type { Product } from "@/types/marketplace";

type ProductType = NonNullable<Product["productType"]>;

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
