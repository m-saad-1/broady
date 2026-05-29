import type { Product } from "@/types/marketplace";

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function isEligibleSearchQuery(query: string, minLength = 3) {
  return normalizeSearchQuery(query).length >= minLength;
}

const colorWords = [
  "black",
  "white",
  "navy",
  "blue",
  "red",
  "green",
  "beige",
  "brown",
  "grey",
  "gray",
  "olive",
  "maroon",
  "cream",
];

const sizeTokens = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl"]);

const subCategoryTokenMap: Record<string, string[]> = {
  shirt: ["Shirts", "Polo Shirts", "T-Shirts"],
  tshirt: ["T-Shirts"],
  tee: ["T-Shirts"],
  polo: ["Polo Shirts"],
  hoodie: ["Hoodies"],
  jacket: ["Jackets"],
  jean: ["Jeans"],
  pant: ["Pants", "Trousers"],
  trouser: ["Trousers"],
  skirt: ["Skirts"],
  sneaker: ["Sneakers"],
  trainer: ["Trainers"],
  shoe: ["Shoes"],
  pump: ["Pumps"],
  sandal: ["Sandals"],
  cap: ["Caps"],
  bag: ["Bags"],
  belt: ["Belts"],
  watch: ["Watches"],
};

function tokenizeSearchQuery(query: string) {
  return query
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 1) || [];
}

function resolveProductGenderTokens(product: Product) {
  const tokens = new Set<string>();
  const top = product.topCategory.toLowerCase();
  if (top.includes("men")) tokens.add("men");
  if (top.includes("women")) tokens.add("women");
  if (top.includes("junior") || top.includes("toddler")) tokens.add("juniors");
  return tokens;
}

function productTextBlob(product: Product) {
  return [
    product.name,
    product.description,
    product.subCategory,
    product.topCategory,
    product.brand?.name,
    product.color,
    ...(product.tags || []),
    ...(product.sizes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tokenMatchesProduct(product: Product, token: string) {
  const genderTokens = resolveProductGenderTokens(product);
  if (["men", "man", "male"].includes(token)) return genderTokens.has("men");
  if (["women", "woman", "female"].includes(token)) return genderTokens.has("women");
  if (["junior", "juniors", "kids", "kid", "toddler", "boy", "girl"].includes(token)) {
    return genderTokens.has("juniors") || product.topCategory.toLowerCase().includes(token);
  }

  if (colorWords.includes(token)) {
    return product.color.toLowerCase().includes(token);
  }

  if (sizeTokens.has(token)) {
    return product.sizes.some((size) => size.toLowerCase() === token);
  }

  if (/^\d{2}$/.test(token)) {
    return product.sizes.some((size) => size.toLowerCase() === token);
  }

  const mappedSubCategories = subCategoryTokenMap[token];
  if (mappedSubCategories?.length) {
    return mappedSubCategories.some((sub) => product.subCategory.toLowerCase().includes(sub.toLowerCase()));
  }

  const blob = productTextBlob(product);
  return blob.includes(token);
}

export function filterProductsBySearchQuery(products: Product[], query: string) {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 3) {
    return [];
  }

  const tokens = tokenizeSearchQuery(normalized);
  if (!tokens.length) {
    return [];
  }

  return products.filter((product) => tokens.every((token) => tokenMatchesProduct(product, token)));
}

export function filterProductsBySubCategoryContains(products: Product[], query: string) {
  return filterProductsBySearchQuery(products, query);
}
