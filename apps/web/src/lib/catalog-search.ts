import type { SearchSuggestion } from "@/types/marketplace";
import { correctSearchQuery } from "@/lib/search-fallback";

export const SUBCATEGORY_BY_TYPE: Record<string, string[]> = {
  Top: ["Shirts", "Polo Shirts", "T-Shirts", "Hoodies", "Jackets"],
  Bottom: ["Jeans", "Pants", "Trousers", "Skirts"],
  Footwear: ["Sneakers", "Trainers", "Shoes", "Pumps", "Sandals"],
  Accessories: ["Caps", "Bags", "Belts", "Watches"],
};

const SUBCATEGORY_TOKEN_MAP: Record<string, string[]> = {
  shirt: ["Shirts", "Polo Shirts", "T-Shirts"],
  shirts: ["Shirts", "Polo Shirts", "T-Shirts"],
  tshirt: ["T-Shirts"],
  tshirts: ["T-Shirts"],
  tee: ["T-Shirts"],
  polo: ["Polo Shirts"],
  hoodie: ["Hoodies"],
  hoodies: ["Hoodies"],
  jacket: ["Jackets"],
  jackets: ["Jackets"],
  jean: ["Jeans"],
  jeans: ["Jeans"],
  pant: ["Pants", "Trousers"],
  pants: ["Pants", "Trousers"],
  trouser: ["Trousers"],
  trousers: ["Trousers"],
  skirt: ["Skirts"],
  skirts: ["Skirts"],
  sneaker: ["Sneakers"],
  sneakers: ["Sneakers"],
  trainer: ["Trainers"],
  trainers: ["Trainers"],
  shoe: ["Shoes"],
  shoes: ["Shoes"],
  pump: ["Pumps"],
  pumps: ["Pumps"],
  sandal: ["Sandals"],
  sandals: ["Sandals"],
  cap: ["Caps"],
  caps: ["Caps"],
  bag: ["Bags"],
  bags: ["Bags"],
  belt: ["Belts"],
  belts: ["Belts"],
  watch: ["Watches"],
  watches: ["Watches"],
};

const TYPE_TOKEN_MAP: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Footwear",
  shoes: "Footwear",
  shoe: "Footwear",
  sneakers: "Footwear",
  sneaker: "Footwear",
  trainers: "Footwear",
  trainer: "Footwear",
  accessories: "Accessories",
  accessory: "Accessories",
};

const SIZE_TOKENS = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl"]);

export type InferredCatalogFilters = {
  topCategory?: string;
  juniorCategory?: string;
  productType?: string;
  subCategory?: string;
  size?: string;
};

function tokenizeQuery(query: string) {
  return correctSearchQuery(query)
    .toLowerCase()
    .replace(/\bt[\s-]?shirts?\b/g, "tshirt")
    .match(/[a-z0-9]+/g)
    ?.map((token) => {
      if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
      if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
      if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
      return token;
    })
    .filter((token) => token.length > 1) || [];
}

export function inferCatalogFiltersFromQuery(query: string): InferredCatalogFilters {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return {};

  const hasMen = tokens.some((t) => ["men", "man", "male"].includes(t));
  const hasWomen = tokens.some((t) => ["women", "woman", "female"].includes(t));
  const hasJunior = tokens.some((t) => ["junior", "kids", "kid", "toddler"].includes(t));
  const hasBoy = tokens.includes("boy") || tokens.includes("boys");
  const hasGirl = tokens.includes("girl") || tokens.includes("girls");

  let topCategory: string | undefined;
  let juniorCategory: string | undefined;

  if (hasMen) topCategory = "Men";
  if (hasWomen) topCategory = "Women";
  if (hasJunior || hasBoy || hasGirl) {
    topCategory = "Juniors";
    if (hasBoy && tokens.includes("toddler")) juniorCategory = "Toddler Boys";
    else if (hasGirl && tokens.includes("toddler")) juniorCategory = "Toddler Girls";
    else if (hasBoy) juniorCategory = "Junior Boys";
    else if (hasGirl) juniorCategory = "Junior Girls";
    else if (tokens.includes("toddler")) juniorCategory = "Toddler Boys";
  }

  const subCategory = tokens
    .map((token) => SUBCATEGORY_TOKEN_MAP[token])
    .filter(Boolean)
    .flat()[0];

  const productType = subCategory
    ? Object.entries(SUBCATEGORY_BY_TYPE).find(([, subs]) => subs.includes(subCategory))?.[0]
    : tokens.map((token) => TYPE_TOKEN_MAP[token]).find(Boolean);

  const size = tokens.find((token) => SIZE_TOKENS.has(token))?.toUpperCase();

  return {
    topCategory,
    juniorCategory,
    productType,
    subCategory,
    size,
  };
}

export function buildCatalogFiltersFromSuggestion(suggestion: SearchSuggestion) {
  const juniorGroups = ["Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"];
  const resolvedJunior = suggestion.juniorCategory || (juniorGroups.includes(suggestion.topCategory || "") ? suggestion.topCategory : undefined);
  const resolvedTopCategory = resolvedJunior ? "Juniors" : suggestion.gender === "Juniors" ? "Juniors" : suggestion.topCategory;

  return {
    q: suggestion.query,
    topCategory: resolvedTopCategory,
    juniorCategory: resolvedJunior,
    productType: suggestion.productType,
    subCategory: suggestion.subCategory,
    size: suggestion.size,
  };
}
