const topCategoryTokenMap: Record<string, "Men" | "Women" | "Kids"> = {
  men: "Men",
  mens: "Men",
  male: "Men",
  man: "Men",
  women: "Women",
  womens: "Women",
  female: "Women",
  woman: "Women",
  kids: "Kids",
  kid: "Kids",
  child: "Kids",
  children: "Kids",
  boys: "Kids",
  girls: "Kids",
};

const searchStopWords = new Set(["for", "and", "the", "a", "an", "of", "to", "in", "on", "with", "by"]);

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
    return { normalizedQuery: query } as { normalizedQuery: string; inferredTopCategory?: "Men" | "Women" | "Kids" };
  }

  const categoryTokenCount = new Map<"Men" | "Women" | "Kids", number>();
  for (const token of tokens) {
    const mapped = topCategoryTokenMap[token];
    if (!mapped) continue;

    categoryTokenCount.set(mapped, (categoryTokenCount.get(mapped) ?? 0) + 1);
  }

  let inferredTopCategory: "Men" | "Women" | "Kids" | undefined;
  const maxCoverage = Math.max(...Array.from(categoryTokenCount.values()), 0);
  const requiredCoverage = Math.ceil(tokens.length * 0.5);

  if (maxCoverage >= requiredCoverage) {
    let bestCategory: "Men" | "Women" | "Kids" | undefined;
    let bestCount = 0;
    for (const [category, count] of categoryTokenCount) {
      if (count <= bestCount) continue;
      bestCount = count;
      bestCategory = category;
    }
    inferredTopCategory = bestCategory;
  }

  const normalizedTokens = inferredTopCategory
    ? tokens.filter((token) => topCategoryTokenMap[token] !== inferredTopCategory)
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
  return tokens.map((token) => topCategoryTokenMap[token]).find((category) => category !== undefined);
}
