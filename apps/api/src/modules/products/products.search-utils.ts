type CatalogTopCategory = "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";

type ProductType = "Top" | "Bottom" | "Footwear" | "Accessories";

const adultCategoryTokenMap: Record<string, CatalogTopCategory> = {
  men: "Men",
  mens: "Men",
  male: "Men",
  man: "Men",
  women: "Women",
  womens: "Women",
  female: "Women",
  woman: "Women",
};

const searchStopWords = new Set(["for", "and", "the", "a", "an", "of", "to", "in", "on", "with", "by"]);

/**
 * Expands catalog top category with junior category refinement
 * Used to filter products by their target demographic
 * 
 * @param topCategory - Main category (Men, Women, Juniors, etc.)
 * @param juniorCategory - Specific junior variant (Junior Boys, Junior Girls, Toddler Boys, etc.) - only used if topCategory is "Juniors"
 * @returns Array of expanded top category values for filtering
 */
export function expandCatalogTopCategory(
  topCategory?: string,
  juniorCategory?: string
): string[] {
  if (!topCategory) {
    return [];
  }

  const normalizedTop = topCategory.toLowerCase();

  // Support legacy plural/group labels and expand to a full junior/toddler set when no specific category is provided.
  if (normalizedTop === "juniors" || normalizedTop === "kids") {
    if (juniorCategory) {
      return [juniorCategory];
    }
    return ["Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"];
  }

  if (juniorCategory && normalizedTop === "juniors") {
    return [juniorCategory];
  }

  // Return the top category as-is
  return [topCategory];
}

export const subCategoryHintMap: Record<string, string[]> = {
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

const subCategoryToType: Record<string, ProductType> = {
  Shirts: "Top",
  "Polo Shirts": "Top",
  "T-Shirts": "Top",
  Hoodies: "Top",
  Jackets: "Top",
  Jeans: "Bottom",
  Pants: "Bottom",
  Trousers: "Bottom",
  Skirts: "Bottom",
  Sneakers: "Footwear",
  Trainers: "Footwear",
  Shoes: "Footwear",
  Pumps: "Footwear",
  Sandals: "Footwear",
  Caps: "Accessories",
  Bags: "Accessories",
  Belts: "Accessories",
  Watches: "Accessories",
};

const typeTokenMap: Record<string, ProductType> = {
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

const sizeTokens = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl"]);

export const colorWords = [
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

export function normalizeSearchInput(input?: string) {
  if (!input) return "";
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSearchToken(token: string) {
  let normalized = token.toLowerCase().trim();

  if (normalized.endsWith("ies") && normalized.length > 4) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith("es") && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("s") && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

export function tokenizeSearchQuery(query: string) {
  return (
    query
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.map((term) => normalizeSearchToken(term))
      .filter((term) => term.length > 1 && !searchStopWords.has(term)) || []
  );
}

export function inferSubCategoryHints(query: string) {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) return [] as string[];

  const categoryMap = new Map<string, Set<string>>();
  for (const token of tokens) {
    const matches = subCategoryHintMap[token];
    if (!matches) continue;

    for (const subCategory of matches) {
      if (!categoryMap.has(subCategory)) {
        categoryMap.set(subCategory, new Set());
      }
      categoryMap.get(subCategory)?.add(token);
    }
  }

  let maxCoverage = 0;
  const bestHints = new Set<string>();

  for (const [subCategory, matchedTokens] of categoryMap) {
    const coverage = matchedTokens.size / tokens.length;
    if (coverage > maxCoverage) {
      maxCoverage = coverage;
      bestHints.clear();
      bestHints.add(subCategory);
    } else if (coverage === maxCoverage) {
      bestHints.add(subCategory);
    }
  }

  return Array.from(bestHints);
}

function isJuniorGroup(value: string | undefined): value is CatalogTopCategory {
  return value === "Junior Boys" || value === "Junior Girls" || value === "Toddler Boys" || value === "Toddler Girls";
}

function inferSizeToken(tokens: string[]) {
  for (const token of tokens) {
    if (sizeTokens.has(token)) return token.toUpperCase();
    if (/^\d{2}$/.test(token)) return token;
  }
  return undefined;
}

function stripFilterTokens(tokens: string[], filters: Set<string>) {
  return tokens.filter((token) => !filters.has(token));
}

export function inferSearchFilters(query: string) {
  const tokens = tokenizeSearchQuery(query);

  const inferredTopCategory = detectTopCategoryToken(tokens);
  const hasJuniorsToken = tokens.includes("juniors") || tokens.includes("kids") || tokens.includes("kid");
  const gender = isJuniorGroup(inferredTopCategory)
    ? "Juniors"
    : inferredTopCategory || (hasJuniorsToken ? "Juniors" : undefined);
  const juniorCategory = isJuniorGroup(inferredTopCategory) ? inferredTopCategory : undefined;

  const subCategoryHints = inferSubCategoryHints(query);
  const subCategory = subCategoryHints[0];
  const productType =
    subCategory ? subCategoryToType[subCategory] : tokens.map((t) => typeTokenMap[t]).find(Boolean);

  const color = tokens.find((token) => colorWords.includes(token));
  const size = inferSizeToken(tokens);

  const filterTokens = new Set<string>();
  if (gender) {
    filterTokens.add(gender.toLowerCase());
  }
  if (juniorCategory) {
    juniorCategory
      .toLowerCase()
      .split(/\s+/)
      .forEach((token) => filterTokens.add(token));
  }
  if (productType) filterTokens.add(productType.toLowerCase());
  if (subCategory) {
    subCategory.toLowerCase().split(/\s+/).forEach((token) => filterTokens.add(token));
  }
  if (color) filterTokens.add(color);
  if (size) filterTokens.add(size.toLowerCase());

  const normalizedQuery = stripFilterTokens(tokens, filterTokens).join(" ").trim() || query;

  return {
    normalizedQuery,
    inferredTopCategory,
    gender,
    juniorCategory,
    productType,
    subCategory,
    subCategoryHints,
    size,
    color,
  };
}

export function inferQueryCategory(query: string) {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) {
    return { normalizedQuery: query } as { normalizedQuery: string; inferredTopCategory?: CatalogTopCategory };
  }

  const inferredTopCategory = detectTopCategoryToken(tokens);

  const normalizedTokens = inferredTopCategory
    ? tokens.filter((token) => !matchesTopCategoryToken(token, inferredTopCategory))
    : tokens;

  return {
    normalizedQuery: normalizedTokens.join(" ").trim() || query,
    inferredTopCategory,
  };
}

export function buildPrefixTsQuery(query: string) {
  const terms = tokenizeSearchQuery(query);
  if (!terms.length) {
    return null;
  }

  return terms.map((term) => `${term}:*`).join(" & ");
}

export function detectTopCategoryToken(tokens: string[]) {
  const hasBoy = tokens.includes("boy");
  const hasGirl = tokens.includes("girl");
  const hasToddler = tokens.includes("toddler") || tokens.includes("baby");

  if (hasToddler && hasGirl) return "Toddler Girls";
  if (hasToddler && hasBoy) return "Toddler Boys";
  if (hasGirl) return "Junior Girls";
  if (hasBoy) return "Junior Boys";
  if (hasToddler) return "Toddler Boys";

  for (const token of tokens) {
    const mapped = adultCategoryTokenMap[token];
    if (mapped) return mapped;
  }

  return undefined;
}

function matchesTopCategoryToken(token: string, category: CatalogTopCategory) {
  switch (category) {
    case "Men":
      return ["men", "mens", "male", "man"].includes(token);
    case "Women":
      return ["women", "womens", "female", "woman"].includes(token);
    case "Toddler Boys":
      return ["toddler", "baby", "boy"].includes(token);
    case "Toddler Girls":
      return ["toddler", "baby", "girl"].includes(token);
    case "Junior Boys":
      return ["boy"].includes(token);
    case "Junior Girls":
      return ["girl"].includes(token);
    default:
      return false;
  }
}
