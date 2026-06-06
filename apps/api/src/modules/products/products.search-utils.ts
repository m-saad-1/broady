type CatalogTopCategory = "Men" | "Women" | "Toddler Boys" | "Toddler Girls" | "Junior Boys" | "Junior Girls";

type ProductType = "Top" | "Bottom" | "Footwear" | "Accessories";

type SubCategoryDefinition = {
  label: string;
  productType: ProductType;
  terms: string[];
};

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

export function expandCatalogTopCategory(
  topCategory?: string,
  juniorCategory?: string
): string[] {
  if (!topCategory) {
    return [];
  }

  const normalizedTop = topCategory.toLowerCase();

  if (normalizedTop === "juniors" || normalizedTop === "kids") {
    if (juniorCategory) {
      return [juniorCategory];
    }
    return ["Toddler Boys", "Toddler Girls", "Junior Boys", "Junior Girls"];
  }

  if (juniorCategory && normalizedTop === "juniors") {
    return [juniorCategory];
  }

  return [topCategory];
}

const subCategoryDefinitions: SubCategoryDefinition[] = [
  { label: "Polo Shirts", productType: "Top", terms: ["polo", "polo shirt", "polo shirts"] },
  { label: "T-Shirts", productType: "Top", terms: ["tshirt", "t shirt", "t shirts", "tee", "tees"] },
  { label: "Shirts", productType: "Top", terms: ["shirt", "shirts", "formal shirt", "overshirt"] },
  { label: "Hoodies", productType: "Top", terms: ["hoodie", "hoodies", "sweatshirt", "sweatshirts"] },
  { label: "Jackets", productType: "Top", terms: ["jacket", "jackets", "coat", "coats", "bomber", "puffer"] },
  { label: "Jeans", productType: "Bottom", terms: ["jean", "jeans", "denim"] },
  { label: "Trousers", productType: "Bottom", terms: ["trouser", "trousers", "pant", "pants", "chino", "chinos"] },
  { label: "Cargo Pants", productType: "Bottom", terms: ["cargo", "cargo pant", "cargo pants"] },
  { label: "Joggers", productType: "Bottom", terms: ["jogger", "joggers"] },
  { label: "Shorts", productType: "Bottom", terms: ["short", "shorts"] },
  { label: "Skirts", productType: "Bottom", terms: ["skirt", "skirts"] },
  { label: "Dresses", productType: "Top", terms: ["dress", "dresses"] },
  { label: "Sneakers", productType: "Footwear", terms: ["sneaker", "sneakers", "trainer", "trainers", "runner", "runners"] },
  { label: "Boots", productType: "Footwear", terms: ["boot", "boots"] },
  { label: "Shoes", productType: "Footwear", terms: ["shoe", "shoes"] },
  { label: "Pumps", productType: "Footwear", terms: ["pump", "pumps"] },
  { label: "Sandals", productType: "Footwear", terms: ["sandal", "sandals"] },
  { label: "Bags", productType: "Accessories", terms: ["bag", "bags", "backpack", "tote"] },
  { label: "Belts", productType: "Accessories", terms: ["belt", "belts"] },
  { label: "Caps", productType: "Accessories", terms: ["cap", "caps", "hat", "hats"] },
  { label: "Watches", productType: "Accessories", terms: ["watch", "watches"] },
  { label: "Socks", productType: "Accessories", terms: ["sock", "socks"] },
];

export const subCategoryHintMap = subCategoryDefinitions.reduce<Record<string, string[]>>((map, definition) => {
  for (const term of definition.terms) {
    for (const token of tokenizePlainText(term)) {
      if (!map[token]) {
        map[token] = [];
      }
      if (!map[token]!.includes(definition.label)) {
        map[token]!.push(definition.label);
      }
    }
  }

  return map;
}, {});

const subCategoryToType = subCategoryDefinitions.reduce<Record<string, ProductType>>((map, definition) => {
  map[definition.label] = definition.productType;
  return map;
}, {});

const typeTokenMap: Record<string, ProductType> = {
  top: "Top",
  tops: "Top",
  bottom: "Bottom",
  bottoms: "Bottom",
  footwear: "Footwear",
  shoe: "Footwear",
  shoes: "Footwear",
  sneaker: "Footwear",
  sneakers: "Footwear",
  trainer: "Footwear",
  trainers: "Footwear",
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
  "khaki",
  "charcoal",
  "pink",
  "purple",
  "yellow",
  "orange",
  "silver",
  "gold",
  "denim",
];

const correctionEntries = [
  ...colorWords.map((word) => ({ token: normalizeSearchToken(word), display: word })),
  ...Object.keys(adultCategoryTokenMap).map((word) => ({ token: normalizeSearchToken(word), display: word })),
  ...Object.keys(typeTokenMap).map((word) => ({ token: normalizeSearchToken(word), display: word })),
  { token: "junior", display: "junior" },
  { token: "kid", display: "kids" },
  { token: "toddler", display: "toddler" },
  { token: "baby", display: "baby" },
  { token: "boy", display: "boys" },
  { token: "girl", display: "girls" },
  ...subCategoryDefinitions.flatMap((definition) =>
    definition.terms.flatMap((term) =>
      rawSearchTokens(term).map((token) => ({
        token: normalizeSearchToken(token),
        display: definition.label.toLowerCase(),
      })),
    ),
  ),
];

const correctionDictionary = Array.from(
  correctionEntries
    .reduce((map, entry) => {
      if (entry.token.length > 1 && !map.has(entry.token)) {
        map.set(entry.token, entry);
      }
      return map;
    }, new Map<string, { token: string; display: string }>())
    .values(),
);

export function normalizeSearchInput(input?: string) {
  if (!input) return "";
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function canonicalizeQueryText(query: string) {
  return normalizeSearchInput(query)
    .replace(/\bt[\s-]?shirts?\b/g, "tshirt")
    .replace(/\bpolo[\s-]?shirts?\b/g, "polo shirt");
}

function rawSearchTokens(query: string) {
  return canonicalizeQueryText(query).match(/[a-z0-9]+/g) || [];
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

function tokenizePlainText(query: string) {
  return rawSearchTokens(query).map((term) => normalizeSearchToken(term)).filter(Boolean);
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + substitutionCost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j]!;
    }
  }

  return previous[b.length]!;
}

function correctionThreshold(token: string) {
  if (token.length >= 7) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

function correctToken(token: string) {
  const normalized = normalizeSearchToken(token);
  if (normalized.length < 3 || /^\d+$/.test(normalized)) {
    return { normalized, display: token.toLowerCase(), corrected: false };
  }

  const exact = correctionDictionary.find((entry) => entry.token === normalized);
  if (exact) {
    return { normalized, display: token.toLowerCase(), corrected: false };
  }

  let best: { token: string; display: string; distance: number } | undefined;
  for (const entry of correctionDictionary) {
    if (Math.abs(entry.token.length - normalized.length) > 2) continue;
    const distance = levenshteinDistance(normalized, entry.token);
    if (distance > correctionThreshold(normalized)) continue;
    if (!best || distance < best.distance || (distance === best.distance && entry.token.length > best.token.length)) {
      best = { ...entry, distance };
    }
  }

  if (!best) {
    return { normalized, display: token.toLowerCase(), corrected: false };
  }

  return { normalized: best.token, display: best.display, corrected: true };
}

export function correctSearchInput(input?: string) {
  const tokens = rawSearchTokens(input || "");
  if (!tokens.length) return "";

  return tokens
    .map((token) => correctToken(token).display)
    .join(" ")
    .trim();
}

export function tokenizeSearchQuery(query: string) {
  return (
    tokenizePlainText(correctSearchInput(query))
      .filter((term) => term.length > 1 && !searchStopWords.has(term)) || []
  );
}

function inferSubCategoryMatches(query: string) {
  const corrected = correctSearchInput(query);
  const tokens = tokenizeSearchQuery(corrected);
  const tokenSet = new Set(tokens);
  if (!tokens.length) return [] as SubCategoryDefinition[];

  const scored = subCategoryDefinitions
    .map((definition) => {
      let score = 0;
      for (const term of definition.terms) {
        const termTokens = tokenizePlainText(term).filter((token) => token.length > 1);
        if (!termTokens.length) continue;

        if (termTokens.every((token) => tokenSet.has(token))) {
          score += termTokens.length * 4;
        }

        if (termTokens.length > 1 && corrected.includes(termTokens.join(" "))) {
          score += termTokens.length * 3;
        }
      }

      return { definition, score };
    })
    .filter((entry) => entry.score > 0);

  if (!scored.length) return [];

  const maxScore = Math.max(...scored.map((entry) => entry.score));
  return scored.filter((entry) => entry.score === maxScore).map((entry) => entry.definition);
}

export function inferSubCategoryHints(query: string) {
  return inferSubCategoryMatches(query).map((match) => match.label);
}

function isJuniorGroup(value: string | undefined): value is CatalogTopCategory {
  return value === "Junior Boys" || value === "Junior Girls" || value === "Toddler Boys" || value === "Toddler Girls";
}

function inferSizeToken(tokens: string[]) {
  for (const token of tokens) {
    if (sizeTokens.has(token)) return token.toUpperCase();
    if (/^\d{1,2}$/.test(token)) return token;
  }
  return undefined;
}

function addNormalizedPhraseTokens(target: Set<string>, value?: string) {
  if (!value) return;
  for (const token of tokenizePlainText(value)) {
    target.add(token);
  }
}

function stripFilterTokens(tokens: string[], filters: Set<string>) {
  return tokens.filter((token) => !filters.has(token));
}

export function inferSearchFilters(query: string) {
  const correctedInput = correctSearchInput(query);
  const normalizedOriginal = normalizeSearchInput(query);
  const tokens = tokenizeSearchQuery(correctedInput);

  const inferredTopCategory = detectTopCategoryToken(tokens);
  const hasJuniorsToken = tokens.includes("junior") || tokens.includes("kid");
  const gender = isJuniorGroup(inferredTopCategory)
    ? "Juniors"
    : inferredTopCategory || (hasJuniorsToken ? "Juniors" : undefined);
  const juniorCategory = isJuniorGroup(inferredTopCategory) ? inferredTopCategory : undefined;

  const subCategoryMatches = inferSubCategoryMatches(correctedInput);
  const subCategoryHints = subCategoryMatches.map((match) => match.label);
  const subCategory = subCategoryHints[0];
  const productType =
    subCategoryMatches.length === 1
      ? subCategoryMatches[0]!.productType
      : tokens.map((t) => typeTokenMap[t]).find(Boolean);

  const color = tokens.find((token) => colorWords.includes(token));
  const size = inferSizeToken(tokens);

  const filterTokens = new Set<string>();
  for (const token of tokens) {
    if (adultCategoryTokenMap[token] || ["junior", "kid", "toddler", "baby", "boy", "girl"].includes(token)) {
      filterTokens.add(token);
    }
    if (typeTokenMap[token] || colorWords.includes(token) || sizeTokens.has(token) || /^\d{1,2}$/.test(token)) {
      filterTokens.add(token);
    }
  }

  if (juniorCategory) {
    addNormalizedPhraseTokens(filterTokens, juniorCategory);
  }
  if (productType) {
    addNormalizedPhraseTokens(filterTokens, productType);
  }
  for (const match of subCategoryMatches) {
    for (const term of match.terms) {
      addNormalizedPhraseTokens(filterTokens, term);
    }
    addNormalizedPhraseTokens(filterTokens, match.label);
  }

  const normalizedQuery = stripFilterTokens(tokens, filterTokens).join(" ").trim();

  return {
    correctedInput,
    correctedQuery: correctedInput && correctedInput !== normalizedOriginal ? correctedInput : undefined,
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
  const correctedInput = correctSearchInput(query);
  const tokens = tokenizeSearchQuery(correctedInput);
  if (!tokens.length) {
    return { normalizedQuery: correctedInput || query } as { normalizedQuery: string; inferredTopCategory?: CatalogTopCategory };
  }

  const inferredTopCategory = detectTopCategoryToken(tokens);

  const normalizedTokens = inferredTopCategory
    ? tokens.filter((token) => !matchesTopCategoryToken(token, inferredTopCategory))
    : tokens;

  return {
    normalizedQuery: normalizedTokens.join(" ").trim(),
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
