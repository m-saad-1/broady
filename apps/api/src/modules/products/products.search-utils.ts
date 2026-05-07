type CatalogTopCategory = "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";

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
  shirt: ["T-Shirts", "Polo Shirts", "V-Neck", "Formal Shirts"],
  tshirt: ["T-Shirts"],
  tee: ["T-Shirts"],
  polo: ["Polo Shirts"],
  vneck: ["V-Neck"],
  pant: ["Trousers", "Jeans", "Joggers", "Cargo Pants"],
  trouser: ["Trousers"],
  jean: ["Jeans"],
};

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
