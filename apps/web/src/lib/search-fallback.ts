import type { Product, SearchSuggestion } from "@/types/marketplace";

type ProductType = NonNullable<Product["productType"]>;
type SearchGender = NonNullable<SearchSuggestion["gender"]>;

type SubCategoryDefinition = {
  label: string;
  productType: ProductType;
  terms: string[];
  suggestionLabel?: string;
};

type SearchIntent = {
  correctedQuery: string;
  tokens: string[];
  searchableTokens: string[];
  gender?: SearchGender;
  juniorCategory?: SearchSuggestion["juniorCategory"];
  productType?: ProductType;
  subCategories: string[];
  color?: string;
  size?: string;
  hasStructuredIntent: boolean;
};

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isEligibleSearchQuery(query: string, minLength = 3) {
  return normalizeSearchQuery(query).length >= minLength;
}

const searchStopWords = new Set(["for", "and", "the", "a", "an", "of", "to", "in", "on", "with", "by"]);

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

const sizeTokens = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl"]);

const adultGenderTokenMap: Record<string, SearchGender> = {
  men: "Men",
  mens: "Men",
  man: "Men",
  male: "Men",
  women: "Women",
  womens: "Women",
  woman: "Women",
  female: "Women",
};

const productTypeTokenMap: Record<string, ProductType> = {
  top: "Top",
  tops: "Top",
  bottom: "Bottom",
  bottoms: "Bottom",
  footwear: "Footwear",
  shoe: "Footwear",
  sneaker: "Footwear",
  trainer: "Footwear",
  accessory: "Accessories",
  accessories: "Accessories",
};

const subCategoryDefinitions: SubCategoryDefinition[] = [
  { label: "Polo Shirts", productType: "Top", terms: ["polo", "polo shirt", "polo shirts"], suggestionLabel: "Polo shirts" },
  { label: "T-Shirts", productType: "Top", terms: ["tshirt", "t shirt", "t shirts", "tee", "tees"], suggestionLabel: "T-shirts" },
  { label: "Shirts", productType: "Top", terms: ["shirt", "shirts", "formal shirt", "overshirt"], suggestionLabel: "Shirts" },
  { label: "Hoodies", productType: "Top", terms: ["hoodie", "hoodies", "sweatshirt", "sweatshirts"], suggestionLabel: "Hoodies" },
  { label: "Jackets", productType: "Top", terms: ["jacket", "jackets", "coat", "coats", "bomber", "puffer"], suggestionLabel: "Jackets" },
  { label: "Jeans", productType: "Bottom", terms: ["jean", "jeans", "denim"], suggestionLabel: "Jeans" },
  { label: "Trousers", productType: "Bottom", terms: ["trouser", "trousers", "pant", "pants", "chino", "chinos"], suggestionLabel: "Trousers" },
  { label: "Cargo Pants", productType: "Bottom", terms: ["cargo", "cargo pant", "cargo pants"], suggestionLabel: "Cargo pants" },
  { label: "Joggers", productType: "Bottom", terms: ["jogger", "joggers"], suggestionLabel: "Joggers" },
  { label: "Shorts", productType: "Bottom", terms: ["short", "shorts"], suggestionLabel: "Shorts" },
  { label: "Skirts", productType: "Bottom", terms: ["skirt", "skirts"], suggestionLabel: "Skirts" },
  { label: "Dresses", productType: "Top", terms: ["dress", "dresses"], suggestionLabel: "Dresses" },
  { label: "Sneakers", productType: "Footwear", terms: ["sneaker", "sneakers", "trainer", "trainers", "runner", "runners"], suggestionLabel: "Sneakers" },
  { label: "Boots", productType: "Footwear", terms: ["boot", "boots"], suggestionLabel: "Boots" },
  { label: "Shoes", productType: "Footwear", terms: ["shoe", "shoes"], suggestionLabel: "Shoes" },
  { label: "Pumps", productType: "Footwear", terms: ["pump", "pumps"], suggestionLabel: "Pumps" },
  { label: "Sandals", productType: "Footwear", terms: ["sandal", "sandals"], suggestionLabel: "Sandals" },
  { label: "Bags", productType: "Accessories", terms: ["bag", "bags", "backpack", "tote"], suggestionLabel: "Bags" },
  { label: "Belts", productType: "Accessories", terms: ["belt", "belts"], suggestionLabel: "Belts" },
  { label: "Caps", productType: "Accessories", terms: ["cap", "caps", "hat", "hats"], suggestionLabel: "Caps" },
  { label: "Watches", productType: "Accessories", terms: ["watch", "watches"], suggestionLabel: "Watches" },
  { label: "Socks", productType: "Accessories", terms: ["sock", "socks"], suggestionLabel: "Socks" },
];

const correctionEntries = [
  ...colorWords.map((word) => ({ token: normalizeSearchToken(word), display: word })),
  ...Object.keys(adultGenderTokenMap).map((word) => ({ token: normalizeSearchToken(word), display: word })),
  ...Object.keys(productTypeTokenMap).map((word) => ({ token: normalizeSearchToken(word), display: word })),
  { token: "junior", display: "junior" },
  { token: "juniors", display: "juniors" },
  { token: "kid", display: "kids" },
  { token: "toddler", display: "toddler" },
  { token: "boy", display: "boys" },
  { token: "girl", display: "girls" },
  ...subCategoryDefinitions.flatMap((definition) =>
    definition.terms.flatMap((term) =>
      rawSearchTokens(term).map((token) => ({
        token: normalizeSearchToken(token),
        display: definition.suggestionLabel?.toLowerCase() || definition.label.toLowerCase(),
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

function canonicalizeQueryText(query: string) {
  return normalizeSearchQuery(query)
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

function tokenizeText(value: string) {
  return rawSearchTokens(value).map(normalizeSearchToken).filter(Boolean);
}

function tokenizeSearchQuery(query: string) {
  return tokenizeText(correctSearchQuery(query)).filter((token) => token.length > 1 && !searchStopWords.has(token));
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

export function correctSearchQuery(query: string) {
  const tokens = rawSearchTokens(query);
  if (!tokens.length) return "";

  return tokens
    .map((token) => correctToken(token).display)
    .join(" ")
    .trim();
}

function normalizedLabel(value?: string | null) {
  return normalizeSearchQuery(value || "").replace(/[^a-z0-9]+/g, " ").trim();
}

function getTermTokens(term: string) {
  return tokenizeText(term).filter((token) => token.length > 1);
}

function inferSubCategoryIntent(tokens: string[], correctedQuery: string) {
  const tokenSet = new Set(tokens);
  const scored = subCategoryDefinitions
    .map((definition) => {
      let score = 0;
      for (const term of definition.terms) {
        const termTokens = getTermTokens(term);
        if (!termTokens.length) continue;

        const allTokensMatch = termTokens.every((token) => tokenSet.has(token));
        if (allTokensMatch) {
          score += termTokens.length * 4;
        }

        if (termTokens.length > 1 && normalizedLabel(correctedQuery).includes(termTokens.join(" "))) {
          score += termTokens.length * 3;
        }
      }

      return { definition, score };
    })
    .filter((entry) => entry.score > 0);

  if (!scored.length) return [];

  const maxScore = Math.max(...scored.map((entry) => entry.score));
  return scored
    .filter((entry) => entry.score === maxScore)
    .map((entry) => entry.definition);
}

function detectJuniorCategory(tokens: string[]) {
  const hasBoy = tokens.includes("boy");
  const hasGirl = tokens.includes("girl");
  const hasToddler = tokens.includes("toddler") || tokens.includes("baby");

  if (hasToddler && hasGirl) return "Toddler Girls" as const;
  if (hasToddler && hasBoy) return "Toddler Boys" as const;
  if (hasGirl) return "Junior Girls" as const;
  if (hasBoy) return "Junior Boys" as const;
  if (hasToddler) return "Toddler Boys" as const;
  return undefined;
}

function inferSearchIntent(query: string): SearchIntent {
  const correctedQuery = correctSearchQuery(query);
  const tokens = tokenizeSearchQuery(correctedQuery);
  const subCategoryMatches = inferSubCategoryIntent(tokens, correctedQuery);
  const juniorCategory = detectJuniorCategory(tokens);
  const hasJuniorToken = tokens.some((token) => ["junior", "juniors", "kid", "kids", "toddler", "boy", "girl"].includes(token));
  const adultGender = tokens.map((token) => adultGenderTokenMap[token]).find(Boolean);
  const gender = juniorCategory || hasJuniorToken ? "Juniors" : adultGender;
  const explicitProductType = tokens.map((token) => productTypeTokenMap[token]).find(Boolean);
  const productType =
    subCategoryMatches.length === 1
      ? subCategoryMatches[0]!.productType
      : explicitProductType;
  const color = tokens.find((token) => colorWords.includes(token));
  const size = tokens.find((token) => sizeTokens.has(token) || /^\d{1,2}$/.test(token))?.toUpperCase();

  const structuredTokens = new Set<string>();
  for (const token of tokens) {
    if (adultGenderTokenMap[token] || ["junior", "juniors", "kid", "kids", "toddler", "baby", "boy", "girl"].includes(token)) {
      structuredTokens.add(token);
    }
    if (productTypeTokenMap[token] || colorWords.includes(token) || sizeTokens.has(token) || /^\d{1,2}$/.test(token)) {
      structuredTokens.add(token);
    }
  }

  for (const definition of subCategoryMatches) {
    for (const term of definition.terms) {
      for (const token of getTermTokens(term)) {
        if (tokens.includes(token)) {
          structuredTokens.add(token);
        }
      }
    }
  }

  const searchableTokens = tokens.filter((token) => !structuredTokens.has(token));
  const subCategories = subCategoryMatches.map((match) => match.label);

  return {
    correctedQuery,
    tokens,
    searchableTokens,
    gender,
    juniorCategory,
    productType,
    subCategories,
    color,
    size,
    hasStructuredIntent: Boolean(gender || juniorCategory || productType || subCategories.length || color || size),
  };
}

function productGender(product: Product) {
  const gender = normalizedLabel(product.gender);
  const topCategory = normalizedLabel(product.topCategory);
  const juniorsGroup = normalizedLabel(product.juniorsGroup);

  if (gender === "men" || topCategory === "men") return "Men";
  if (gender === "women" || topCategory === "women") return "Women";
  if (
    gender === "juniors" ||
    juniorsGroup ||
    topCategory === "junior boys" ||
    topCategory === "junior girls" ||
    topCategory === "toddler boys" ||
    topCategory === "toddler girls"
  ) {
    return "Juniors";
  }

  return product.gender;
}

function productMatchesGender(product: Product, intent: SearchIntent) {
  if (!intent.gender) return true;
  return productGender(product) === intent.gender;
}

function productMatchesJuniorCategory(product: Product, intent: SearchIntent) {
  if (!intent.juniorCategory) return true;
  const juniorCategory = normalizedLabel(intent.juniorCategory);
  return normalizedLabel(product.juniorsGroup) === juniorCategory || normalizedLabel(product.topCategory) === juniorCategory;
}

function productMatchesType(product: Product, intent: SearchIntent) {
  if (!intent.productType) return true;
  const productType = product.productType || (product as Product & { type?: ProductType }).type;
  return normalizedLabel(productType) === normalizedLabel(intent.productType);
}

function productMatchesSubCategory(product: Product, intent: SearchIntent) {
  if (!intent.subCategories.length) return true;
  const productSubCategory = normalizedLabel(product.subCategory);
  return intent.subCategories.some((subCategory) => productSubCategory === normalizedLabel(subCategory));
}

function productColors(product: Product) {
  const variantColors = Array.isArray(product.variants)
    ? product.variants.map((variant) => variant.color || "").filter(Boolean)
    : [];
  return [product.color, ...(product.colors || []), ...variantColors].map(normalizedLabel).filter(Boolean);
}

function productMatchesColor(product: Product, intent: SearchIntent) {
  if (!intent.color) return true;
  return productColors(product).some((color) => color.split(" ").includes(intent.color!) || color === intent.color);
}

function productSizes(product: Product) {
  const variantSizes = Array.isArray(product.variants)
    ? product.variants.map((variant) => variant.size || "").filter(Boolean)
    : [];
  return [...(product.sizes || []), ...variantSizes].map((size) => normalizeSearchQuery(size));
}

function productMatchesSize(product: Product, intent: SearchIntent) {
  if (!intent.size) return true;
  const normalizedSize = normalizeSearchQuery(intent.size);
  return productSizes(product).some((size) => size === normalizedSize);
}

function flattenUnknownText(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenUnknownText);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flattenUnknownText);
  return [];
}

function productSearchValues(product: Product) {
  const variantValues = Array.isArray(product.variants)
    ? product.variants.flatMap((variant) => [
        variant.sku,
        variant.barcode,
        variant.color,
        variant.size,
        variant.fit,
        variant.season,
        variant.style,
        ...flattenUnknownText(variant.metadata),
      ])
    : [];

  return [
    product.name,
    product.shortDescription,
    product.description,
    product.descriptionLong,
    product.brand?.name,
    product.brand?.slug,
    product.gender,
    product.topCategory,
    product.juniorsGroup,
    product.productType,
    (product as Product & { type?: string }).type,
    product.subCategory,
    product.color,
    ...(product.colors || []),
    ...(product.sizes || []),
    ...(product.tags || []),
    product.fit,
    product.season,
    product.collection,
    product.label,
    ...flattenUnknownText(product.additionalInfo),
    ...flattenUnknownText(product.detail),
    ...flattenUnknownText(product.seo),
    ...variantValues,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function valueMatchesToken(value: string, token: string) {
  const normalizedValue = normalizedLabel(value);
  if (!normalizedValue) return false;

  const valueTokens = tokenizeText(normalizedValue);
  return valueTokens.some((valueToken) => valueToken === token || (token.length >= 3 && valueToken.startsWith(token)));
}

function productMatchesToken(product: Product, token: string) {
  return productSearchValues(product).some((value) => valueMatchesToken(value, token));
}

function productMatchesIntent(product: Product, intent: SearchIntent) {
  if (!productMatchesGender(product, intent)) return false;
  if (!productMatchesJuniorCategory(product, intent)) return false;
  if (!productMatchesType(product, intent)) return false;
  if (!productMatchesSubCategory(product, intent)) return false;
  if (!productMatchesColor(product, intent)) return false;
  if (!productMatchesSize(product, intent)) return false;

  return intent.searchableTokens.every((token) => productMatchesToken(product, token));
}

function scoreField(value: string | undefined | null, tokens: string[], exactPhrase: string, weight: number) {
  if (!value) return 0;

  const normalizedValue = normalizedLabel(value);
  let score = 0;
  if (exactPhrase && normalizedValue === exactPhrase) score += weight * 4;
  if (exactPhrase && normalizedValue.startsWith(exactPhrase)) score += weight * 2;
  if (exactPhrase && normalizedValue.includes(exactPhrase)) score += weight;

  for (const token of tokens) {
    if (valueMatchesToken(normalizedValue, token)) {
      score += weight;
    }
  }

  return score;
}

function scoreProduct(product: Product, intent: SearchIntent) {
  if (!productMatchesIntent(product, intent)) return -1;

  const exactPhrase = normalizedLabel(intent.correctedQuery);
  let score = 0;

  score += scoreField(product.name, intent.tokens, exactPhrase, 18);
  score += scoreField(product.subCategory, intent.tokens, exactPhrase, 14);
  score += scoreField(product.brand?.name, intent.tokens, exactPhrase, 12);
  score += scoreField(product.color, intent.tokens, exactPhrase, 10);
  score += scoreField(product.description, intent.tokens, exactPhrase, 4);
  score += scoreField(product.shortDescription, intent.tokens, exactPhrase, 4);

  if (intent.gender && productMatchesGender(product, intent)) score += 12;
  if (intent.subCategories.length && productMatchesSubCategory(product, intent)) score += 18;
  if (intent.color && productMatchesColor(product, intent)) score += 12;
  if (intent.size && productMatchesSize(product, intent)) score += 8;
  if (intent.productType && productMatchesType(product, intent)) score += 8;

  return score;
}

export function rankProductsBySearchQuery(products: Product[], query: string) {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 3) {
    return [];
  }

  const intent = inferSearchIntent(normalized);
  if (!intent.tokens.length) {
    return [];
  }

  return products
    .map((product, index) => ({ product, score: scoreProduct(product, intent), index }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

export function filterProductsBySearchQuery(products: Product[], query: string) {
  return rankProductsBySearchQuery(products, query).map((entry) => entry.product);
}

export function filterProductsBySubCategoryContains(products: Product[], query: string) {
  return filterProductsBySearchQuery(products, query);
}

function suggestionFromQuery(
  id: string,
  label: string,
  query: string,
  extra: Partial<SearchSuggestion> = {},
): SearchSuggestion {
  return {
    id,
    label,
    query,
    kind: "query",
    ...extra,
  };
}

function addSuggestion(
  suggestions: SearchSuggestion[],
  seen: Set<string>,
  suggestion: SearchSuggestion,
) {
  const key = `${suggestion.kind}:${normalizeSearchQuery(suggestion.query)}:${normalizeSearchQuery(suggestion.label)}`;
  if (seen.has(key)) return;
  seen.add(key);
  suggestions.push(suggestion);
}

function buildTypedQuerySuggestions(intent: SearchIntent) {
  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();
  const primarySubCategory = intent.subCategories[0];
  const subDefinition = subCategoryDefinitions.find((definition) => definition.label === primarySubCategory);
  const label = subDefinition?.suggestionLabel || primarySubCategory;

  if (primarySubCategory && label) {
    const normalizedLabel = label.toLowerCase();
    if (primarySubCategory === "Jeans") {
      addSuggestion(suggestions, seen, suggestionFromQuery("intent:baggy-jeans", "Baggy jeans", "baggy jeans", {
        productType: "Bottom",
        subCategory: "Jeans",
      }));
      addSuggestion(suggestions, seen, suggestionFromQuery("intent:girls-jeans", "Girls jeans", "girls jeans", {
        gender: "Juniors",
        topCategory: "Junior Girls",
        juniorCategory: "Junior Girls",
        productType: "Bottom",
        subCategory: "Jeans",
      }));
    }

    addSuggestion(suggestions, seen, suggestionFromQuery(`intent:men-${normalizedLabel}`, `Men ${normalizedLabel}`, `men ${normalizedLabel}`, {
      gender: "Men",
      topCategory: "Men",
      productType: subDefinition?.productType,
      subCategory: primarySubCategory,
    }));
    addSuggestion(suggestions, seen, suggestionFromQuery(`intent:women-${normalizedLabel}`, `Women ${normalizedLabel}`, `women ${normalizedLabel}`, {
      gender: "Women",
      topCategory: "Women",
      productType: subDefinition?.productType,
      subCategory: primarySubCategory,
    }));
    addSuggestion(suggestions, seen, suggestionFromQuery(`intent:junior-${normalizedLabel}`, `Junior ${normalizedLabel}`, `junior ${normalizedLabel}`, {
      gender: "Juniors",
      productType: subDefinition?.productType,
      subCategory: primarySubCategory,
    }));
    addSuggestion(suggestions, seen, suggestionFromQuery(`intent:black-${normalizedLabel}`, `Black ${normalizedLabel}`, `black ${normalizedLabel}`, {
      productType: subDefinition?.productType,
      subCategory: primarySubCategory,
      color: "black",
    }));
  } else {
    const corrected = intent.correctedQuery;
    for (const definition of subCategoryDefinitions) {
      const suggestionLabel = definition.suggestionLabel || definition.label;
      const normalizedSuggestion = suggestionLabel.toLowerCase();
      if (!normalizedSuggestion.startsWith(corrected) && !definition.terms.some((term) => term.startsWith(corrected))) {
        continue;
      }

      addSuggestion(suggestions, seen, suggestionFromQuery(`type:${definition.label}`, suggestionLabel, suggestionLabel, {
        productType: definition.productType,
        subCategory: definition.label,
      }));
    }
  }

  return suggestions;
}

export function buildSearchSuggestions(products: Product[], query: string, limit = 8) {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 2) return [];

  const intent = inferSearchIntent(normalized);
  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of buildTypedQuerySuggestions(intent)) {
    addSuggestion(suggestions, seen, suggestion);
  }

  const rankedProducts = rankProductsBySearchQuery(products, intent.correctedQuery || normalized).slice(0, 5);
  for (const { product } of rankedProducts) {
    addSuggestion(suggestions, seen, {
      id: `product:${product.id}`,
      label: product.name,
      query: product.name,
      kind: "product",
      topCategory: product.topCategory,
      gender: product.gender,
      juniorCategory: product.juniorsGroup,
      productType: product.productType,
      subCategory: product.subCategory,
      brand: product.brand?.name,
      color: product.color,
    });
  }

  const brandMatches = products
    .map((product) => product.brand?.name)
    .filter((brand): brand is string => Boolean(brand))
    .filter((brand, index, brands) => brands.findIndex((item) => normalizeSearchQuery(item) === normalizeSearchQuery(brand)) === index)
    .filter((brand) => valueMatchesToken(brand, normalizeSearchToken(normalized)));

  for (const brand of brandMatches.slice(0, 3)) {
    addSuggestion(suggestions, seen, suggestionFromQuery(`brand:${brand}`, brand, brand, { brand }));
  }

  return suggestions.slice(0, limit);
}
