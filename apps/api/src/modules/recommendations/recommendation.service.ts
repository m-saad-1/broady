import { Prisma, UserActivityEventType, ProductCategory, ProductGender } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { getRedisClient } from "../../config/redis.js";

type RecommendationActor = {
  userId?: string;
  anonymousSessionId?: string;
};

type TrackUserActivityInput = RecommendationActor & {
  eventType: UserActivityEventType;
  productId?: string;
  variantId?: string;
  brandId?: string;
  searchQuery?: string;
  filters?: Record<string, unknown>;
  sourcePage?: string;
  device?: string;
  gender?: string;
  topCategory?: string;
  subCategory?: string;
  metadata?: Record<string, unknown>;
};

type RecommendationOptions = RecommendationActor & {
  limit?: number;
  topCategory?: string;
  subCategory?: string;
};

type RecommendationSurface = "FOR_YOU" | "SIMILAR_ITEMS" | "TRENDING" | "POPULAR_IN_CATEGORY";

type RecommendationMeta = {
  impressionId?: string;
  surface: RecommendationSurface;
  algorithm: string;
  generatedAt: string;
  reason?: string;
};

const productInclude = {
  brand: true,
  reviewAggregate: true,
  detail: true,
  attributes: true,
} satisfies Prisma.ProductInclude;

type RecommendationProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ScoredProduct = { product: RecommendationProduct; score: number };

type PreferenceProfile = {
  seedProductScores: Map<string, number>;
  brandScores: Map<string, number>;
  topCategoryScores: Map<string, number>;
  subCategoryScores: Map<string, number>;
  colorScores: Map<string, number>;
  sizeScores: Map<string, number>;
  fitScores: Map<string, number>;
  styleTagScores: Map<string, number>;
  searchTermScores: Map<string, number>;
  rankedSeedProductIds: string[];
  rankedBrandIds: string[];
  rankedTopCategories: string[];
  rankedSubCategories: string[];
  rankedColors: string[];
  rankedSizes: string[];
  rankedFits: string[];
  rankedStyleTags: string[];
  rankedSearchTerms: string[];
  preferredGender: string | null;
  priceRange: { min: number; max: number } | null;
};

type CandidateRetrieval = {
  candidates: RecommendationProduct[];
  seedProducts: RecommendationProduct[];
  sourceScores: Map<string, number>;
  popularityByProductId: Map<string, number>;
  popularityBaseline: number;
  medianSeedPrice: number | null;
};

const ACTIVITY_WEIGHTS: Record<UserActivityEventType, number> = {
  PRODUCT_VIEW: 1,
  PRODUCT_CLICK: 1.2,
  PRODUCT_ADDED_TO_CART: 6,
  PRODUCT_REMOVED_FROM_CART: -1.5,
  PRODUCT_PURCHASED: 8,
  PRODUCT_RETURNED: -4,
  PRODUCT_CANCELLED: -3,
  SEARCH_QUERY: 2,
  CATEGORY_BROWSE: 2,
  FILTER_USED: 1.5,
  WISHLIST_ADDED: 4,
  CHECKOUT_STARTED: 5,
  ORDER_PLACED: 7,
  RECOMMENDATION_CLICK: 3.2,
  EXPLICIT_PRODUCT_INTEREST: 4,
};

const PRODUCT_REQUIRED_EVENTS = new Set<UserActivityEventType>([
  UserActivityEventType.PRODUCT_VIEW,
  UserActivityEventType.PRODUCT_CLICK,
  UserActivityEventType.PRODUCT_ADDED_TO_CART,
  UserActivityEventType.PRODUCT_REMOVED_FROM_CART,
  UserActivityEventType.PRODUCT_PURCHASED,
  UserActivityEventType.PRODUCT_RETURNED,
  UserActivityEventType.PRODUCT_CANCELLED,
  UserActivityEventType.WISHLIST_ADDED,
  UserActivityEventType.RECOMMENDATION_CLICK,
  UserActivityEventType.EXPLICIT_PRODUCT_INTEREST,
]);

const RECOMMENDATION_CACHE_TTL_SECONDS = 10 * 60;
const FALLBACK_CACHE_TTL_SECONDS = 5 * 60;
const ACTIVE_PRODUCT_WHERE = {
  isActive: true,
  approvalStatus: "APPROVED" as const,
  stock: { gt: 0 },
};

const TOP_CATEGORY_ALIASES = new Map<string, string>([
  ["men", "Men"],
  ["man", "Men"],
  ["mens", "Men"],
  ["women", "Women"],
  ["woman", "Women"],
  ["womens", "Women"],
  ["juniors", "Juniors"],
  ["junior", "Juniors"],
  ["kids", "Juniors"],
  ["kid", "Juniors"],
  ["children", "Juniors"],
  ["junior boys", "Junior Boys"],
  ["boys junior", "Junior Boys"],
  ["toddler boys", "Toddler Boys"],
  ["junior girls", "Junior Girls"],
  ["girls junior", "Junior Girls"],
  ["toddler girls", "Toddler Girls"],
]);

const metrics = {
  eventsTracked: 0,
  eventsSkippedValidation: 0,
  eventsSkippedDuplicate: 0,
  recommendationRequests: 0,
  recommendationCacheHits: 0,
  recommendationCacheMisses: 0,
  fallbackCacheHits: 0,
  fallbackCacheMisses: 0,
  impressionsLogged: 0,
  clicksLogged: 0,
};

let lastMetricsLogAt = 0;

function maybeLogMetrics(reason: string, force = false) {
  const now = Date.now();
  if (!force && now - lastMetricsLogAt < 60_000) {
    return;
  }

  lastMetricsLogAt = now;
  const requestCount = Math.max(metrics.recommendationRequests, 1);
  const recommendationHitRate = ((metrics.recommendationCacheHits / requestCount) * 100).toFixed(1);
  const fallbackTotal = metrics.fallbackCacheHits + metrics.fallbackCacheMisses;
  const fallbackHitRate = fallbackTotal ? ((metrics.fallbackCacheHits / fallbackTotal) * 100).toFixed(1) : "0.0";
  const ctr = metrics.impressionsLogged ? ((metrics.clicksLogged / metrics.impressionsLogged) * 100).toFixed(1) : "0.0";

  console.info("[recommendations][metrics]", {
    reason,
    eventsTracked: metrics.eventsTracked,
    eventsSkippedValidation: metrics.eventsSkippedValidation,
    eventsSkippedDuplicate: metrics.eventsSkippedDuplicate,
    recommendationRequests: metrics.recommendationRequests,
    recommendationCacheHits: metrics.recommendationCacheHits,
    recommendationCacheMisses: metrics.recommendationCacheMisses,
    recommendationCacheHitRatePct: recommendationHitRate,
    fallbackCacheHits: metrics.fallbackCacheHits,
    fallbackCacheMisses: metrics.fallbackCacheMisses,
    fallbackCacheHitRatePct: fallbackHitRate,
    impressionsLogged: metrics.impressionsLogged,
    clicksLogged: metrics.clicksLogged,
    clickThroughRatePct: ctr,
  });
}

function clampLimit(limit: number | undefined, fallback = 16, max = 40) {
  const raw = Number(limit || fallback);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), max) : fallback;
}

function normalizeWhitespace(value?: string | null) {
  const normalized = (value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeAliasKey(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTopCategoryValue(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return TOP_CATEGORY_ALIASES.get(normalizeAliasKey(normalized)) || normalized;
}

function normalizeCategoryValue(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalized;
}

function normalizeGenderValue(value?: string | null) {
  const normalized = normalizeTopCategoryValue(value);
  if (!normalized) return null;
  return normalized === "Juniors" ? "Juniors" : normalized;
}

function normalizeTokenValue(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalizeAliasKey(normalized).replace(/\s+/g, "_");
}

function normalizeColorValue(value?: string | null) {
  const normalized = normalizeTokenValue(value);
  if (!normalized) return null;
  return normalized.replace(/^multi_colour$/, "multi_color").replace(/^multicolour$/, "multi_color").replace(/^multi_color$/, "multi_color");
}

function normalizeSearchQuery(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeComparison(value?: string | null) {
  return (value || "").normalize("NFKC").trim().toLowerCase();
}

function mapStringToCategory(value: string | null | undefined): ProductCategory | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, "_");
  if (normalized === "TSHIRT" || normalized === "T_SHIRT") return ProductCategory.T_SHIRTS;
  const validCategories = Object.values(ProductCategory);
  if (validCategories.includes(normalized as ProductCategory)) {
    return normalized as ProductCategory;
  }
  const found = validCategories.find((c) => normalized.includes(c) || c.includes(normalized));
  if (found) return found as ProductCategory;
  return null;
}

function mapStringToGender(value: string | null | undefined): ProductGender | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("women")) return ProductGender.WOMEN;
  if (normalized.includes("men")) return ProductGender.MEN;
  if (normalized.includes("girl")) return ProductGender.GIRLS;
  if (normalized.includes("boy")) return ProductGender.BOYS;
  if (normalized.includes("unisex")) return ProductGender.UNISEX;
  return null;
}

export function sanitizeRecommendationSessionId(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  if (!/^[a-zA-Z0-9:_-]{12,96}$/.test(normalized)) return undefined;
  return normalized;
}

function getActorKey(actor: RecommendationActor) {
  if (actor.userId) return `user:${actor.userId}`;
  if (actor.anonymousSessionId) return `anon:${actor.anonymousSessionId}`;
  return "global";
}

function getActorRecommendationCachePrefix(actor: RecommendationActor) {
  if (actor.userId) return `recommendations:user:${actor.userId}`;
  if (actor.anonymousSessionId) return `recommendations:session:${actor.anonymousSessionId}`;
  return "recommendations:global";
}

function buildActorWhere(actor: RecommendationActor): Prisma.UserActivityWhereInput | null {
  if (actor.userId) return { userId: actor.userId };
  if (actor.anonymousSessionId) return { anonymousSessionId: actor.anonymousSessionId };
  return null;
}

function activityRecencyMultiplier(createdAt: Date) {
  const ageMs = Date.now() - createdAt.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs <= 7 * dayMs) return 1.35;
  if (ageMs <= 30 * dayMs) return 1.15;
  if (ageMs <= 90 * dayMs) return 1;
  return 0.8;
}

function tokenizeSearchQuery(query?: string | null) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8);
}

function calculatePriceSimilarity(price: number, medianSeedPrice: number | null) {
  if (!medianSeedPrice || medianSeedPrice <= 0) return 0;
  const delta = Math.abs(price - medianSeedPrice);
  return Math.max(0, 1 - delta / medianSeedPrice);
}

function calculateMedian(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function hashToUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function resolveAlgorithmVariant(actor: RecommendationActor) {
  const actorKey = getActorKey(actor);
  if (actorKey === "global") return "hybrid_v2";
  return hashToUnit(actorKey) >= 0.82 ? "hybrid_v2_explore" : "hybrid_v2";
}

function compactJson(input?: Record<string, unknown>): Prisma.InputJsonObject | undefined {
  if (!input) return undefined;
  const output: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || typeof value === "function") continue;
    output[key] = value as Prisma.InputJsonValue;
  }
  return Object.keys(output).length ? (output as Prisma.InputJsonObject) : undefined;
}

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function getMetadataNumber(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getMetadataStringArray(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const value = (metadata as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function addScore(map: Map<string, number>, key: string | null | undefined, score: number) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + score);
}

function rankMap(map: Map<string, number>, limit: number) {
  return [...map.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function rankMapKeys(map: Map<string, number>, limit: number) {
  return rankMap(map, limit).map(([key]) => key);
}

function profileJsonEntries(map: Map<string, number>, limit: number) {
  return rankMap(map, limit).map(([value, score]) => ({
    value,
    score: Number(score.toFixed(3)),
  }));
}

function hasRecommendationAttribution(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  return Boolean(record.recommendationSurface || record.impressionId || record.algorithm || record.source === "recommendation");
}

async function readRedisJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisClient().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeRedisJson<T>(key: string, value: T, ttlSeconds: number) {
  try {
    await getRedisClient().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Ignore cache write failures.
  }
}

async function bumpRecommendationVersion(actor: RecommendationActor) {
  if (!actor.userId && !actor.anonymousSessionId) return;
  try {
    await getRedisClient().incr(`recommendations:version:${getActorKey(actor)}`);
  } catch {
    // Ignore cache version failures.
  }
}

async function getRecommendationVersion(actor: RecommendationActor) {
  if (!actor.userId && !actor.anonymousSessionId) return "0";
  try {
    const value = await getRedisClient().get(`recommendations:version:${getActorKey(actor)}`);
    return value || "0";
  } catch {
    return "0";
  }
}

export async function mergeAnonymousRecommendationSession(actor: RecommendationActor) {
  if (!actor.userId || !actor.anonymousSessionId) return;

  await Promise.allSettled([
    prisma.userActivity.updateMany({
      where: {
        anonymousSessionId: actor.anonymousSessionId,
        userId: null,
      },
      data: {
        userId: actor.userId,
      },
    }),
    prisma.recommendationImpression.updateMany({
      where: {
        anonymousSessionId: actor.anonymousSessionId,
        userId: null,
      },
      data: {
        userId: actor.userId,
      },
    }),
    prisma.recommendationClick.updateMany({
      where: {
        anonymousSessionId: actor.anonymousSessionId,
        userId: null,
      },
      data: {
        userId: actor.userId,
      },
    }),
  ]);

  await bumpRecommendationVersion({ userId: actor.userId });
}

async function buildAndStoreUserRecommendationProfile(userId: string, lastAnonymousSessionId?: string) {
  const activities = await prisma.userActivity.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
    },
    select: {
      brandId: true,
      gender: true,
      topCategory: true,
      subCategory: true,
      searchQuery: true,
      filters: true,
      metadata: true,
      weight: true,
      createdAt: true,
      product: {
        select: {
          brandId: true,
          gender: true,
          colors: true,
          primaryColor: true,
          sizes: true,
          fit: true,
          season: true,
          tags: true,
          pricePkr: true,
          category: true,
          subcategory: true,
          detail: {
            select: {
              fabricComposition: true,
              materialDetails: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 900,
  });

  const genderScores = new Map<string, number>();
  const categoryScores = new Map<string, number>();
  const subCategoryScores = new Map<string, number>();
  const brandScores = new Map<string, number>();
  const colorScores = new Map<string, number>();
  const sizeScores = new Map<string, number>();
  const fitScores = new Map<string, number>();
  const styleTagScores = new Map<string, number>();
  const priceSamples: number[] = [];

  for (const activity of activities) {
    const score = activity.weight * activityRecencyMultiplier(activity.createdAt);
    const metadata = activity.metadata;
    const filters = activity.filters;
    const rawProduct = activity.product;
    const product = rawProduct ? {
      ...rawProduct,
      color: rawProduct.primaryColor || rawProduct.colors?.[0] || "",
      topCategory: rawProduct.category,
      subCategory: rawProduct.subcategory || "",
    } : null;

    addScore(genderScores, normalizeGenderValue(activity.gender || product?.gender || activity.topCategory || product?.topCategory), score);
    addScore(categoryScores, normalizeTopCategoryValue(activity.topCategory || product?.topCategory), score);
    addScore(subCategoryScores, normalizeCategoryValue(activity.subCategory || product?.subCategory), score);
    addScore(brandScores, activity.brandId || product?.brandId, score);
    addScore(colorScores, normalizeColorValue(product?.color || getMetadataString(metadata, "selectedColor") || getMetadataString(filters, "color")), score);
    addScore(fitScores, normalizeTokenValue(product?.fit || getMetadataString(filters, "fit")), score);

    for (const size of product?.sizes || []) {
      addScore(sizeScores, normalizeTokenValue(size), score * 0.35);
    }
    addScore(sizeScores, normalizeTokenValue(getMetadataString(metadata, "selectedSize") || getMetadataString(filters, "size")), score);

    for (const tag of product?.tags || []) {
      addScore(styleTagScores, normalizeTokenValue(tag), score * 0.6);
    }
    addScore(styleTagScores, normalizeTokenValue(product?.season), score * 0.35);
    addScore(styleTagScores, normalizeTokenValue(product?.detail?.fabricComposition), score * 0.25);
    addScore(styleTagScores, normalizeTokenValue(product?.detail?.materialDetails), score * 0.25);

    for (const token of tokenizeSearchQuery(activity.searchQuery)) {
      addScore(styleTagScores, normalizeTokenValue(token), score * 0.4);
    }
    for (const key of ["styleTags", "tags"]) {
      for (const tag of getMetadataStringArray(metadata, key)) {
        addScore(styleTagScores, normalizeTokenValue(tag), score);
      }
    }

    if (product?.pricePkr && product.pricePkr > 0 && score > 0) {
      priceSamples.push(product.pricePkr);
    }
  }

  const sortedPrices = [...priceSamples].sort((a, b) => a - b);
  const lowerIndex = sortedPrices.length ? Math.max(0, Math.floor(sortedPrices.length * 0.15) - 1) : -1;
  const upperIndex = sortedPrices.length ? Math.min(sortedPrices.length - 1, Math.ceil(sortedPrices.length * 0.85) - 1) : -1;
  const preferredGender = rankMapKeys(genderScores, 1)[0] || null;

  await prisma.userRecommendationProfile.upsert({
    where: { userId },
    create: {
      userId,
      preferredGender,
      topCategories: profileJsonEntries(categoryScores, 8),
      topSubCategories: profileJsonEntries(subCategoryScores, 12),
      topBrands: profileJsonEntries(brandScores, 10),
      topColors: profileJsonEntries(colorScores, 10),
      topSizes: profileJsonEntries(sizeScores, 12),
      topFits: profileJsonEntries(fitScores, 8),
      styleTags: profileJsonEntries(styleTagScores, 16),
      priceMinPkr: lowerIndex >= 0 ? sortedPrices[lowerIndex] : null,
      priceMaxPkr: upperIndex >= 0 ? sortedPrices[upperIndex] : null,
      lastAnonymousSessionId,
      lastBuiltAt: new Date(),
    },
    update: {
      preferredGender,
      topCategories: profileJsonEntries(categoryScores, 8),
      topSubCategories: profileJsonEntries(subCategoryScores, 12),
      topBrands: profileJsonEntries(brandScores, 10),
      topColors: profileJsonEntries(colorScores, 10),
      topSizes: profileJsonEntries(sizeScores, 12),
      topFits: profileJsonEntries(fitScores, 8),
      styleTags: profileJsonEntries(styleTagScores, 16),
      priceMinPkr: lowerIndex >= 0 ? sortedPrices[lowerIndex] : null,
      priceMaxPkr: upperIndex >= 0 ? sortedPrices[upperIndex] : null,
      lastAnonymousSessionId,
      lastBuiltAt: new Date(),
    },
  });
}

export async function rebuildRecommendationProfiles(options?: { limit?: number; days?: number }) {
  const limit = Math.min(Math.max(Math.floor(options?.limit || 500), 1), 5_000);
  const days = Math.min(Math.max(Math.floor(options?.days || 180), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      activities: {
        some: {
          createdAt: { gte: since },
        },
      },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let rebuilt = 0;
  for (const user of users) {
    await buildAndStoreUserRecommendationProfile(user.id);
    rebuilt += 1;
  }

  return { rebuilt, scannedUsers: users.length, windowDays: days };
}

async function getProductsByIds(ids: string[], limit: number) {
  if (!ids.length) return [];
  const products = await prisma.product.findMany({
    where: {
      ...ACTIVE_PRODUCT_WHERE,
      id: { in: ids },
    },
    include: productInclude,
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  return ids
    .map((id) => productById.get(id))
    .filter((item): item is RecommendationProduct => Boolean(item))
    .slice(0, limit);
}

async function logRecommendationImpression(input: {
  actor: RecommendationActor;
  surface: RecommendationSurface;
  algorithm: string;
  productIds: string[];
  context?: Record<string, unknown>;
}) {
  if (!input.productIds.length) return undefined;

  try {
    const impression = await prisma.recommendationImpression.create({
      data: {
        userId: input.actor.userId,
        anonymousSessionId: input.actor.anonymousSessionId,
        surface: input.surface,
        algorithm: input.algorithm,
        productIds: input.productIds,
        context: compactJson(input.context),
      },
      select: { id: true },
    });
    metrics.impressionsLogged += 1;
    maybeLogMetrics("impression-logged");
    return impression.id;
  } catch (error) {
    console.warn("[recommendations] failed to log impression", error);
    return undefined;
  }
}

async function logRecommendationClick(input: {
  actor: RecommendationActor;
  productId: string;
  impressionId?: string;
  surface?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.recommendationClick.create({
      data: {
        userId: input.actor.userId,
        anonymousSessionId: input.actor.anonymousSessionId,
        productId: input.productId,
        impressionId: input.impressionId,
        surface: input.surface || "FOR_YOU",
        metadata: compactJson(input.metadata),
      },
    });
    metrics.clicksLogged += 1;
    maybeLogMetrics("click-logged");
  } catch (error) {
    console.warn("[recommendations] failed to log click", error);
  }
}

function buildRecommendationResult(input: {
  actor: RecommendationActor;
  surface: RecommendationSurface;
  algorithm: string;
  products: RecommendationProduct[];
  reason?: string;
  context?: Record<string, unknown>;
}) {
  return logRecommendationImpression({
    actor: input.actor,
    surface: input.surface,
    algorithm: input.algorithm,
    productIds: input.products.map((product) => product.id),
    context: input.context,
  }).then((impressionId) => ({
    products: input.products,
    meta: {
      impressionId,
      surface: input.surface,
      algorithm: input.algorithm,
      generatedAt: new Date().toISOString(),
      reason: input.reason,
    } satisfies RecommendationMeta,
  }));
}

export async function trackUserActivity(input: TrackUserActivityInput) {
  const actor: RecommendationActor = {
    userId: input.userId,
    anonymousSessionId: sanitizeRecommendationSessionId(input.anonymousSessionId),
  };

  if (!actor.userId && !actor.anonymousSessionId) {
    metrics.eventsSkippedValidation += 1;
    maybeLogMetrics("skip-missing-actor");
    return { tracked: false, reason: "missing-actor" };
  }

  const rawProduct = input.productId
    ? await prisma.product.findFirst({
        where: {
          id: input.productId,
          ...ACTIVE_PRODUCT_WHERE,
        },
        select: {
          id: true,
          brandId: true,
          category: true,
          subcategory: true,
          gender: true,
          colors: true,
          primaryColor: true,
          sizes: true,
          fit: true,
          tags: true,
          pricePkr: true,
        },
      })
    : null;

  const product = rawProduct
    ? {
        ...rawProduct,
        color: rawProduct.primaryColor || rawProduct.colors?.[0] || "",
        topCategory: rawProduct.category,
        subCategory: rawProduct.subcategory || "",
      }
    : null;

  if (PRODUCT_REQUIRED_EVENTS.has(input.eventType) && !product) {
    metrics.eventsSkippedValidation += 1;
    maybeLogMetrics("skip-invalid-product");
    return { tracked: false, reason: "invalid-product" };
  }

  const searchQuery = normalizeSearchQuery(input.searchQuery);
  const topCategory = normalizeTopCategoryValue(input.topCategory || product?.topCategory);
  const subCategory = normalizeCategoryValue(input.subCategory || product?.subCategory);
  const brandId = normalizeWhitespace(input.brandId || product?.brandId);
  const gender = normalizeGenderValue(input.gender || product?.gender || topCategory);
  const sourcePage = normalizeWhitespace(input.sourcePage || getMetadataString(input.metadata, "sourcePage") || getMetadataString(input.metadata, "source"));
  const device = normalizeWhitespace(input.device || getMetadataString(input.metadata, "device"));
  const filters = compactJson(input.filters);

  if (input.eventType === UserActivityEventType.SEARCH_QUERY && !searchQuery) {
    metrics.eventsSkippedValidation += 1;
    maybeLogMetrics("skip-invalid-event");
    return { tracked: false, reason: "missing-search-query" };
  }

  if (
    (input.eventType === UserActivityEventType.CATEGORY_BROWSE || input.eventType === UserActivityEventType.FILTER_USED) &&
    !topCategory &&
    !subCategory &&
    !filters
  ) {
    metrics.eventsSkippedValidation += 1;
    maybeLogMetrics("skip-invalid-event");
    return { tracked: false, reason: "missing-category" };
  }

  const duplicateWindowMinutes =
    input.eventType === UserActivityEventType.PRODUCT_VIEW
      ? 20
      : input.eventType === UserActivityEventType.PRODUCT_ADDED_TO_CART
        ? 10
        : input.eventType === UserActivityEventType.SEARCH_QUERY ||
            input.eventType === UserActivityEventType.CATEGORY_BROWSE ||
            input.eventType === UserActivityEventType.FILTER_USED
          ? 5
          : input.eventType === UserActivityEventType.PRODUCT_CLICK || input.eventType === UserActivityEventType.RECOMMENDATION_CLICK
            ? 3
            : 0;

  const actorWhere = buildActorWhere(actor);
  if (duplicateWindowMinutes && actorWhere) {
    const duplicate = await prisma.userActivity.findFirst({
      where: {
        ...actorWhere,
        eventType: input.eventType,
        productId: product?.id,
        searchQuery: searchQuery || undefined,
        topCategory: topCategory || undefined,
        subCategory: subCategory || undefined,
        createdAt: {
          gte: new Date(Date.now() - duplicateWindowMinutes * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      metrics.eventsSkippedDuplicate += 1;
      maybeLogMetrics("skip-duplicate-event");
      return { tracked: false, reason: "duplicate" };
    }
  }

  const metadata = compactJson({
    ...input.metadata,
    normalizedTopCategory: topCategory || undefined,
    normalizedSubCategory: subCategory || undefined,
    normalizedColor: normalizeColorValue(product?.color || getMetadataString(input.metadata, "selectedColor")),
    normalizedSizes: (product?.sizes || []).map((size) => normalizeTokenValue(size)).filter(Boolean),
    normalizedFit: normalizeTokenValue(product?.fit),
    productBrandId: brandId,
    productPricePkr: product?.pricePkr,
  });

  await prisma.userActivity.create({
    data: {
      userId: actor.userId,
      anonymousSessionId: actor.anonymousSessionId,
      eventType: input.eventType,
      productId: product?.id,
      variantId: normalizeWhitespace(input.variantId),
      brandId,
      searchQuery,
      filters,
      sourcePage,
      device,
      gender,
      topCategory,
      subCategory,
      weight: ACTIVITY_WEIGHTS[input.eventType],
      metadata,
    },
  });

  if (input.eventType === UserActivityEventType.RECOMMENDATION_CLICK && product) {
    await logRecommendationClick({
      actor,
      productId: product.id,
      impressionId: getMetadataString(metadata, "impressionId"),
      surface: getMetadataString(metadata, "recommendationSurface") || getMetadataString(metadata, "surface"),
      metadata: metadata as Record<string, unknown>,
    });
  }

  metrics.eventsTracked += 1;
  if (metrics.eventsTracked % 25 === 0) {
    maybeLogMetrics("events-tracked-batch", true);
  } else {
    maybeLogMetrics("event-tracked");
  }

  await bumpRecommendationVersion(actor);
  if (actor.userId) {
    await buildAndStoreUserRecommendationProfile(actor.userId, actor.anonymousSessionId);
  }
  return { tracked: true };
}

async function getFallbackProducts(limit: number, excludeProductIds: string[] = []) {
  const cacheKey = `recommendations:fallback:${limit}`;
  const cached = await readRedisJson<string[]>(cacheKey);
  if (cached?.length) {
    metrics.fallbackCacheHits += 1;
    maybeLogMetrics("fallback-cache-hit");
    const ordered = await getProductsByIds(
      cached.filter((id) => !excludeProductIds.includes(id)),
      limit,
    );
    if (ordered.length >= Math.min(limit, 6)) {
      return ordered;
    }
  }

  metrics.fallbackCacheMisses += 1;
  maybeLogMetrics("fallback-cache-miss");

  const [topPurchased, topViewed, latest, topRated] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 140,
    }),
    prisma.userActivity.groupBy({
      by: ["productId"],
      where: {
        eventType: { in: [UserActivityEventType.PRODUCT_VIEW, UserActivityEventType.PRODUCT_CLICK] },
        productId: { not: null },
        createdAt: { gte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
      },
      _sum: { weight: true },
      orderBy: { _sum: { weight: "desc" } },
      take: 140,
    }),
    prisma.product.findMany({
      where: ACTIVE_PRODUCT_WHERE,
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 140,
    }),
    prisma.productReviewAggregate.findMany({
      where: {
        totalReviews: { gt: 0 },
        product: ACTIVE_PRODUCT_WHERE,
      },
      select: { productId: true },
      orderBy: [{ averageRating: "desc" }, { totalReviews: "desc" }],
      take: 140,
    }),
  ]);

  const rankedIds = [
    ...topPurchased.map((item) => item.productId),
    ...topViewed.map((item) => item.productId).filter((id): id is string => Boolean(id)),
    ...topRated.map((item) => item.productId),
    ...latest.map((item) => item.id),
  ];

  const dedupedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of rankedIds) {
    if (!id || seen.has(id) || excludeProductIds.includes(id)) continue;
    seen.add(id);
    dedupedIds.push(id);
    if (dedupedIds.length >= limit * 4) break;
  }

  const ordered = await getProductsByIds(dedupedIds, limit);
  await writeRedisJson(cacheKey, ordered.map((item) => item.id), FALLBACK_CACHE_TTL_SECONDS);

  return ordered;
}

async function getPopularityMaps(productIds?: string[]) {
  const orderItemWhere = productIds?.length ? { productId: { in: productIds } } : {};
  const activityProductIdWhere = productIds?.length ? { in: productIds } : { not: null };
  const [purchases, activities] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: orderItemWhere,
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: productIds?.length ? productIds.length : 240,
    }),
    prisma.userActivity.groupBy({
      by: ["productId"],
      where: {
        eventType: {
          in: [
            UserActivityEventType.PRODUCT_VIEW,
            UserActivityEventType.PRODUCT_CLICK,
            UserActivityEventType.PRODUCT_ADDED_TO_CART,
            UserActivityEventType.WISHLIST_ADDED,
          ],
        },
        productId: activityProductIdWhere,
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      _sum: { weight: true },
      orderBy: { _sum: { weight: "desc" } },
      take: productIds?.length ? productIds.length : 240,
    }),
  ]);

  const popularityByProductId = new Map<string, number>();
  let popularityBaseline = 1;

  for (const item of purchases) {
    const total = (item._sum.quantity || 0) * 2.5;
    popularityByProductId.set(item.productId, (popularityByProductId.get(item.productId) || 0) + total);
  }

  for (const item of activities) {
    if (!item.productId) continue;
    const total = item._sum.weight || 0;
    popularityByProductId.set(item.productId, (popularityByProductId.get(item.productId) || 0) + total);
  }

  for (const total of popularityByProductId.values()) {
    if (total > popularityBaseline) popularityBaseline = total;
  }

  return { popularityByProductId, popularityBaseline };
}

function buildPreferenceProfile(activities: Array<{
  productId: string | null;
  brandId?: string | null;
  gender?: string | null;
  topCategory: string | null;
  subCategory: string | null;
  searchQuery: string | null;
  filters?: Prisma.JsonValue | null;
  metadata?: Prisma.JsonValue | null;
  weight: number;
  createdAt: Date;
}>) {
  const seedProductScores = new Map<string, number>();
  const brandScores = new Map<string, number>();
  const topCategoryScores = new Map<string, number>();
  const subCategoryScores = new Map<string, number>();
  const genderScores = new Map<string, number>();
  const colorScores = new Map<string, number>();
  const sizeScores = new Map<string, number>();
  const fitScores = new Map<string, number>();
  const styleTagScores = new Map<string, number>();
  const searchTermScores = new Map<string, number>();
  const priceSamples: number[] = [];

  for (const activity of activities) {
    const recency = activityRecencyMultiplier(activity.createdAt);
    const weightedScore = activity.weight * recency;

    if (activity.productId) {
      seedProductScores.set(activity.productId, (seedProductScores.get(activity.productId) || 0) + weightedScore);
    }

    addScore(brandScores, activity.brandId, weightedScore);
    addScore(genderScores, normalizeGenderValue(activity.gender || activity.topCategory), weightedScore);
    addScore(topCategoryScores, activity.topCategory, weightedScore);
    addScore(subCategoryScores, activity.subCategory, weightedScore);
    addScore(colorScores, normalizeColorValue(getMetadataString(activity.metadata, "selectedColor") || getMetadataString(activity.filters, "color") || getMetadataString(activity.metadata, "normalizedColor")), weightedScore);
    addScore(sizeScores, normalizeTokenValue(getMetadataString(activity.metadata, "selectedSize") || getMetadataString(activity.filters, "size")), weightedScore);
    addScore(fitScores, normalizeTokenValue(getMetadataString(activity.filters, "fit") || getMetadataString(activity.metadata, "normalizedFit")), weightedScore);

    for (const size of getMetadataStringArray(activity.metadata, "normalizedSizes")) {
      addScore(sizeScores, size, weightedScore * 0.35);
    }
    for (const tag of getMetadataStringArray(activity.metadata, "styleTags")) {
      addScore(styleTagScores, normalizeTokenValue(tag), weightedScore);
    }

    const price = getMetadataNumber(activity.metadata, "productPricePkr") || 0;
    if (Number.isFinite(price) && price > 0) {
      priceSamples.push(price);
    }

    if (activity.searchQuery) {
      for (const token of tokenizeSearchQuery(activity.searchQuery)) {
        searchTermScores.set(token, (searchTermScores.get(token) || 0) + weightedScore);
        addScore(styleTagScores, normalizeTokenValue(token), weightedScore * 0.35);
      }
    }
  }

  const sortedPrices = priceSamples.sort((a, b) => a - b);

  return {
    seedProductScores,
    brandScores,
    topCategoryScores,
    subCategoryScores,
    colorScores,
    sizeScores,
    fitScores,
    styleTagScores,
    searchTermScores,
    rankedSeedProductIds: rankMapKeys(seedProductScores, 36),
    rankedBrandIds: rankMapKeys(brandScores, 10),
    rankedTopCategories: rankMapKeys(topCategoryScores, 8),
    rankedSubCategories: rankMapKeys(subCategoryScores, 12),
    rankedColors: rankMapKeys(colorScores, 10),
    rankedSizes: rankMapKeys(sizeScores, 12),
    rankedFits: rankMapKeys(fitScores, 8),
    rankedStyleTags: rankMapKeys(styleTagScores, 14),
    rankedSearchTerms: rankMapKeys(searchTermScores, 10),
    preferredGender: rankMapKeys(genderScores, 1)[0] || null,
    priceRange: sortedPrices.length
      ? {
          min: sortedPrices[Math.max(0, Math.floor(sortedPrices.length * 0.15) - 1)],
          max: sortedPrices[Math.min(sortedPrices.length - 1, Math.ceil(sortedPrices.length * 0.85) - 1)],
        }
      : null,
  } satisfies PreferenceProfile;
}

function addSourceProducts(
  productById: Map<string, RecommendationProduct>,
  sourceScores: Map<string, number>,
  products: RecommendationProduct[],
  weight: number,
) {
  for (const product of products) {
    productById.set(product.id, product);
    sourceScores.set(product.id, (sourceScores.get(product.id) || 0) + weight);
  }
}

async function getCollaborativeCandidateScores(seedProductIds: string[], actor: RecommendationActor) {
  const scores = new Map<string, number>();
  if (!seedProductIds.length) return scores;

  const recentSeedActivities = await prisma.userActivity.findMany({
    where: {
      productId: { in: seedProductIds },
      createdAt: { gte: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) },
    },
    select: {
      userId: true,
      anonymousSessionId: true,
    },
    take: 300,
  });

  const neighborUserIds = Array.from(
    new Set(recentSeedActivities.map((item) => item.userId).filter((value): value is string => Boolean(value && value !== actor.userId))),
  ).slice(0, 120);
  const neighborSessionIds = Array.from(
    new Set(
      recentSeedActivities
        .map((item) => item.anonymousSessionId)
        .filter((value): value is string => Boolean(value && value !== actor.anonymousSessionId)),
    ),
  ).slice(0, 120);

  if (neighborUserIds.length || neighborSessionIds.length) {
    const neighborActorFilters: Prisma.UserActivityWhereInput[] = [];
    if (neighborUserIds.length) {
      neighborActorFilters.push({ userId: { in: neighborUserIds } });
    }
    if (neighborSessionIds.length) {
      neighborActorFilters.push({ anonymousSessionId: { in: neighborSessionIds } });
    }

    const neighborActivities = await prisma.userActivity.findMany({
      where: {
        OR: neighborActorFilters,
        productId: { not: null, notIn: seedProductIds },
        createdAt: { gte: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) },
      },
      select: {
        productId: true,
        weight: true,
      },
      take: 500,
    });

    for (const activity of neighborActivities) {
      if (!activity.productId) continue;
      scores.set(activity.productId, (scores.get(activity.productId) || 0) + activity.weight * 0.6);
    }
  }

  const seedOrderItems = await prisma.orderItem.findMany({
    where: { productId: { in: seedProductIds } },
    select: { orderId: true },
    take: 220,
  });
  const orderIds = Array.from(new Set(seedOrderItems.map((item) => item.orderId)));

  if (orderIds.length) {
    const coPurchased = await prisma.orderItem.findMany({
      where: {
        orderId: { in: orderIds },
        productId: { notIn: seedProductIds },
      },
      select: {
        productId: true,
        quantity: true,
      },
      take: 500,
    });

    for (const item of coPurchased) {
      scores.set(item.productId, (scores.get(item.productId) || 0) + item.quantity * 1.25);
    }
  }

  return new Map([...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 90));
}

async function retrieveCandidateProducts(profile: PreferenceProfile, actor: RecommendationActor, limit: number): Promise<CandidateRetrieval> {
  const seedProducts = await prisma.product.findMany({
    where: {
      id: { in: profile.rankedSeedProductIds },
      ...ACTIVE_PRODUCT_WHERE,
    },
    include: productInclude,
  });

  const seedBrandIds = Array.from(new Set([...seedProducts.map((item) => item.brandId), ...profile.rankedBrandIds])).slice(0, 10);
  const seedTopCategories = Array.from(new Set(seedProducts.map((item) => item.gender))).slice(0, 8);
  const seedSubCategories = Array.from(new Set(seedProducts.map((item) => item.category))).slice(0, 12);
  const seedPrices = seedProducts.map((item) => item.pricePkr);
  const medianSeedPrice = calculateMedian(seedPrices);
  const productById = new Map<string, RecommendationProduct>();
  const sourceScores = new Map<string, number>();

  const sourceQueries: Array<Promise<{ products: RecommendationProduct[]; weight: number }>> = [];

  if (seedSubCategories.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          category: { in: seedSubCategories },
        },
        include: productInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 140,
      }).then((products) => ({ products, weight: 3.2 })),
    );
  }

  const mappedSubCategories = profile.rankedSubCategories.map(mapStringToCategory).filter((x): x is ProductCategory => x !== null);
  if (mappedSubCategories.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          category: { in: mappedSubCategories },
        },
        include: productInclude,
        take: 140,
      }).then((products) => ({ products, weight: 2.8 })),
    );
  }

  const mappedTopCategories = Array.from(new Set([
    ...seedTopCategories,
    ...profile.rankedTopCategories.map(mapStringToGender).filter((x): x is ProductGender => x !== null)
  ]));
  if (mappedTopCategories.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          gender: { in: mappedTopCategories },
        },
        include: productInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 120,
      }).then((products) => ({ products, weight: 1.8 })),
    );
  }

  if (seedBrandIds.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          brandId: { in: seedBrandIds },
        },
        include: productInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 100,
      }).then((products) => ({ products, weight: 1.5 })),
    );
  }

  const rankedContentTerms = Array.from(new Set([...profile.rankedSearchTerms, ...profile.rankedStyleTags])).slice(0, 10);
  if (rankedContentTerms.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          OR: rankedContentTerms.slice(0, 8).map((term) => ({
            searchDocument: { contains: term, mode: "insensitive" },
          })),
        },
        include: productInclude,
        take: 80,
      }).then((products) => ({ products, weight: 1.4 })),
    );
  }

  const priceRangeCategories = profile.rankedTopCategories.map(mapStringToGender).filter((x): x is ProductGender => x !== null);
  if (profile.priceRange && priceRangeCategories.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          gender: { in: priceRangeCategories },
          pricePkr: {
            gte: Math.max(0, Math.floor(profile.priceRange.min * 0.75)),
            lte: Math.ceil(profile.priceRange.max * 1.25),
          },
        },
        include: productInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 90,
      }).then((products) => ({ products, weight: 1.3 })),
    );
  }

  const collaborativeScores = await getCollaborativeCandidateScores(profile.rankedSeedProductIds.slice(0, 16), actor);
  const collaborativeIds = [...collaborativeScores.keys()].slice(0, 90);
  if (collaborativeIds.length) {
    sourceQueries.push(
      prisma.product.findMany({
        where: {
          ...ACTIVE_PRODUCT_WHERE,
          id: { in: collaborativeIds },
        },
        include: productInclude,
        take: 90,
      }).then((products) => ({ products, weight: 2.4 })),
    );
  }

  const sourceResults = await Promise.all(sourceQueries);
  for (const result of sourceResults) {
    addSourceProducts(productById, sourceScores, result.products, result.weight);
  }

  for (const [productId, score] of collaborativeScores.entries()) {
    sourceScores.set(productId, (sourceScores.get(productId) || 0) + score);
  }

  if (productById.size < limit * 2) {
    const fallback = await getFallbackProducts(limit * 2, profile.rankedSeedProductIds);
    addSourceProducts(productById, sourceScores, fallback, 0.8);
  }

  const candidates = [...productById.values()];
  const { popularityByProductId, popularityBaseline } = await getPopularityMaps(candidates.map((item) => item.id));

  return {
    candidates,
    seedProducts,
    sourceScores,
    popularityByProductId,
    popularityBaseline,
    medianSeedPrice,
  };
}

function genderToLegacyTopCategory(gender: ProductGender): string {
  if (gender === ProductGender.MEN) return "Men";
  if (gender === ProductGender.WOMEN) return "Women";
  if (gender === ProductGender.BOYS) return "Junior Boys";
  if (gender === ProductGender.GIRLS) return "Junior Girls";
  return "Unisex";
}

function getGenderInterest(profile: PreferenceProfile, gender: ProductGender): number {
  const legacyTop = genderToLegacyTopCategory(gender).toLowerCase();
  let score = 0;
  for (const [key, val] of profile.topCategoryScores.entries()) {
    const normKey = (key || "").toLowerCase().trim();
    if (normKey === legacyTop || normKey.includes(legacyTop) || legacyTop.includes(normKey)) {
      score += val;
    }
  }
  return score;
}

function getCategoryInterest(profile: PreferenceProfile, category: ProductCategory): number {
  const normalizedCat = category.toLowerCase().replace(/_/g, " ");
  let score = 0;
  for (const [key, val] of profile.subCategoryScores.entries()) {
    const normKey = (key || "").toLowerCase().replace(/[_-]+/g, " ").trim();
    if (normKey === normalizedCat) {
      score += val;
    }
  }
  return score;
}

function scoreAndDiversifyCandidates(input: {
  profile: PreferenceProfile;
  retrieval: CandidateRetrieval;
  limit: number;
  algorithm: string;
  excludeProductIds?: string[];
}) {
  const seedProductIds = new Set(input.profile.rankedSeedProductIds);
  const excluded = new Set(input.excludeProductIds || []);
  const seedSubCategorySet = new Set(input.retrieval.seedProducts.map((item) => item.category));
  const seedTopCategorySet = new Set(input.retrieval.seedProducts.map((item) => item.gender));
  const seedBrandSet = new Set(input.retrieval.seedProducts.map((item) => item.brandId));
  const seedColorSet = new Set(input.retrieval.seedProducts.map((item) => normalizeComparison(item.primaryColor || item.colors?.[0] || "")).filter(Boolean));
  const now = Date.now();

  const scoredCandidates = input.retrieval.candidates
    .filter((candidate) => !excluded.has(candidate.id) && !seedProductIds.has(candidate.id))
    .map((candidate) => {
      let score = input.retrieval.sourceScores.get(candidate.id) || 0;

      const candidateColor = candidate.primaryColor || candidate.colors?.[0] || "";

      if (seedSubCategorySet.has(candidate.category)) score += 2.2;
      if (seedTopCategorySet.has(candidate.gender)) score += 1.1;
      if (seedBrandSet.has(candidate.brandId)) score += 1.4;
      if (seedColorSet.has(normalizeComparison(candidateColor))) score += 0.5;

      const topCategoryInterest = getGenderInterest(input.profile, candidate.gender);
      const subCategoryInterest = getCategoryInterest(input.profile, candidate.category);
      const brandInterest = input.profile.brandScores.get(candidate.brandId) || 0;
      const colorInterest = input.profile.colorScores.get(normalizeColorValue(candidateColor) || "") || 0;
      const fitInterest = input.profile.fitScores.get(normalizeTokenValue(candidate.fit) || "") || 0;
      score += topCategoryInterest * 0.35 + subCategoryInterest * 0.45;
      score += brandInterest * 0.28 + colorInterest * 0.2 + fitInterest * 0.18;

      for (const size of candidate.sizes || []) {
        score += (input.profile.sizeScores.get(normalizeTokenValue(size) || "") || 0) * 0.05;
      }

      const candidateSearchText = normalizeComparison(
        `${candidate.name} ${candidate.subcategory || ""} ${candidate.category} ${candidate.gender} ${candidate.fit || ""} ${candidate.season || ""} ${(candidate.tags || []).join(" ")} ${candidate.detail?.fabricComposition || ""} ${candidate.detail?.materialDetails || ""} ${candidate.searchDocument || ""}`,
      );
      for (const term of [...input.profile.rankedSearchTerms, ...input.profile.rankedStyleTags]) {
        if (candidateSearchText.includes(term)) {
          score += 0.9;
        }
      }

      score += calculatePriceSimilarity(candidate.pricePkr, input.retrieval.medianSeedPrice) * 1.1;
      if (input.profile.priceRange && candidate.pricePkr >= input.profile.priceRange.min && candidate.pricePkr <= input.profile.priceRange.max) {
        score += 0.55;
      }

      const popularity = input.retrieval.popularityByProductId.get(candidate.id) || 0;
      score += (popularity / input.retrieval.popularityBaseline) * 1.4;

      const ageDays = (now - candidate.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays <= 14) score += 0.45;
      else if (ageDays <= 45) score += 0.2;

      if (candidate.reviewAggregate && candidate.reviewAggregate.totalReviews > 0) {
        score += (candidate.reviewAggregate.averageRating / 5) * 0.65;
        score += Math.min(candidate.reviewAggregate.totalReviews, 40) / 100;
      }

      if (candidate.stock > 0) score += 0.35;
      if (candidate.discountPercentage && candidate.discountPercentage > 0) score += 0.18;
      if (input.profile.preferredGender && candidate.gender !== input.profile.preferredGender) {
        score -= 1.2;
      }

      if (input.algorithm === "hybrid_v2_explore") {
        score += hashToUnit(candidate.id) * 0.4;
        if (ageDays <= 45) score += 0.25;
      }

      return { product: candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  return diversifyProducts(scoredCandidates, input.limit);
}

function diversifyProducts(scoredCandidates: ScoredProduct[], limit: number) {
  const diversified: ScoredProduct[] = [];
  const overflow: ScoredProduct[] = [];
  const subCategoryCount = new Map<string, number>();
  const brandCount = new Map<string, number>();
  const maxPerSubCategory = Math.max(2, Math.ceil(limit / 4));
  const maxPerBrand = Math.max(3, Math.ceil(limit / 3));

  for (const entry of scoredCandidates) {
    const subCategoryTotal = subCategoryCount.get(entry.product.category) || 0;
    const brandTotal = brandCount.get(entry.product.brandId) || 0;
    if (subCategoryTotal >= maxPerSubCategory || brandTotal >= maxPerBrand) {
      overflow.push(entry);
      continue;
    }

    diversified.push(entry);
    subCategoryCount.set(entry.product.category, subCategoryTotal + 1);
    brandCount.set(entry.product.brandId, brandTotal + 1);
    if (diversified.length >= limit) break;
  }

  if (diversified.length < limit) {
    for (const entry of overflow) {
      diversified.push(entry);
      if (diversified.length >= limit) break;
    }
  }

  return diversified.slice(0, limit).map((entry) => entry.product);
}

async function getTrendingProducts(options: {
  limit: number;
  topCategory?: string | null;
  subCategory?: string | null;
  excludeProductIds?: string[];
  allowFallback?: boolean;
}) {
  const topCategory = normalizeTopCategoryValue(options.topCategory);
  const subCategory = normalizeCategoryValue(options.subCategory);
  const excludeProductIds = options.excludeProductIds || [];
  const allowFallback = options.allowFallback ?? true;

  if (!topCategory && !subCategory) {
    return allowFallback ? getFallbackProducts(options.limit, excludeProductIds) : [];
  }

  const genderQuery = topCategory ? mapStringToGender(topCategory) : undefined;
  const categoryQuery = subCategory ? mapStringToCategory(subCategory) : undefined;

  const candidateProducts = await prisma.product.findMany({
    where: {
      ...ACTIVE_PRODUCT_WHERE,
      ...(genderQuery ? { gender: genderQuery } : {}),
      ...(categoryQuery ? { category: categoryQuery } : {}),
      ...(excludeProductIds.length ? { id: { notIn: excludeProductIds } } : {}),
    },
    include: productInclude,
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(180, options.limit * 8),
  });

  if (!candidateProducts.length) {
    return allowFallback ? getFallbackProducts(options.limit, excludeProductIds) : [];
  }

  const { popularityByProductId, popularityBaseline } = await getPopularityMaps(candidateProducts.map((product) => product.id));
  const now = Date.now();
  const scored = candidateProducts
    .map((product) => {
      let score = 0;
      const popularity = popularityByProductId.get(product.id) || 0;
      score += (popularity / popularityBaseline) * 4;
      const ageDays = (now - product.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      score += Math.max(0, 1 - ageDays / 120) * 1.4;
      if (product.reviewAggregate && product.reviewAggregate.totalReviews > 0) {
        score += (product.reviewAggregate.averageRating / 5) * 0.8;
        score += Math.min(product.reviewAggregate.totalReviews, 50) / 100;
      }
      return { product, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = diversifyProducts(scored, options.limit);
  if (allowFallback && selected.length < options.limit) {
    const fallback = await getFallbackProducts(options.limit - selected.length, [
      ...excludeProductIds,
      ...selected.map((item) => item.id),
    ]);
    selected.push(...fallback);
  }
  return selected;
}

export async function getForYouRecommendations(actor: RecommendationActor, options?: RecommendationOptions) {
  metrics.recommendationRequests += 1;
  const limit = clampLimit(options?.limit);
  const algorithm = resolveAlgorithmVariant(actor);
  const topCategory = normalizeTopCategoryValue(options?.topCategory);
  const subCategory = normalizeCategoryValue(options?.subCategory);
  const version = await getRecommendationVersion(actor);
  const cacheKey = `${getActorRecommendationCachePrefix(actor)}:v:${version}:l:${limit}:tc:${topCategory || "any"}:sc:${subCategory || "any"}:a:${algorithm}`;
  const cachedIds = await readRedisJson<string[]>(cacheKey);

  if (cachedIds?.length) {
    metrics.recommendationCacheHits += 1;
    maybeLogMetrics("recommendation-cache-hit");
    const ordered = await getProductsByIds(cachedIds, limit);
    if (ordered.length >= Math.min(limit, 6)) {
      return buildRecommendationResult({
        actor,
        surface: "FOR_YOU",
        algorithm,
        products: ordered,
        reason: "cache-hit",
        context: { cacheHit: true, topCategory, subCategory },
      });
    }
  }

  metrics.recommendationCacheMisses += 1;
  maybeLogMetrics("recommendation-cache-miss");

  const actorWhere = buildActorWhere(actor);
  if (!actorWhere) {
    const products = await getTrendingProducts({ limit, topCategory, subCategory });
    return buildRecommendationResult({
      actor,
      surface: "FOR_YOU",
      algorithm,
      products,
      reason: "anonymous-cold-start",
      context: { topCategory, subCategory },
    });
  }

  const activities = await prisma.userActivity.findMany({
    where: {
      ...actorWhere,
      createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 800,
  });

  if (!activities.length && (topCategory || subCategory)) {
    const products = await getTrendingProducts({ limit, topCategory, subCategory });
    return buildRecommendationResult({
      actor,
      surface: "FOR_YOU",
      algorithm,
      products,
      reason: "preference-cold-start",
      context: { topCategory, subCategory },
    });
  }

  if (!activities.length) {
    const products = await getFallbackProducts(limit);
    return buildRecommendationResult({
      actor,
      surface: "FOR_YOU",
      algorithm,
      products,
      reason: "global-cold-start",
    });
  }

  const profile = buildPreferenceProfile(activities);
  if (topCategory) {
    profile.topCategoryScores.set(topCategory, (profile.topCategoryScores.get(topCategory) || 0) + 3);
    if (!profile.rankedTopCategories.includes(topCategory)) {
      profile.rankedTopCategories.unshift(topCategory);
    }
  }
  if (subCategory) {
    profile.subCategoryScores.set(subCategory, (profile.subCategoryScores.get(subCategory) || 0) + 3);
    if (!profile.rankedSubCategories.includes(subCategory)) {
      profile.rankedSubCategories.unshift(subCategory);
    }
  }

  const retrieval = await retrieveCandidateProducts(profile, actor, limit);
  let selected = scoreAndDiversifyCandidates({
    profile,
    retrieval,
    limit,
    algorithm,
  });

  if (!selected.length) {
    selected = await getFallbackProducts(limit, profile.rankedSeedProductIds);
  }

  if (selected.length < limit) {
    const fallback = await getFallbackProducts(limit - selected.length, [
      ...profile.rankedSeedProductIds,
      ...selected.map((item) => item.id),
    ]);
    selected.push(...fallback);
  }

  await writeRedisJson(cacheKey, selected.map((item) => item.id), RECOMMENDATION_CACHE_TTL_SECONDS);

  return buildRecommendationResult({
    actor,
    surface: "FOR_YOU",
    algorithm,
    products: selected,
    reason: "hybrid-ranked",
    context: {
      topCategory,
      subCategory,
      seedProducts: profile.rankedSeedProductIds.slice(0, 8),
      topCategories: profile.rankedTopCategories.slice(0, 4),
      subCategories: profile.rankedSubCategories.slice(0, 6),
      searchTerms: profile.rankedSearchTerms.slice(0, 6),
    },
  });
}

export async function getTrendingRecommendations(actor: RecommendationActor, options?: RecommendationOptions) {
  const limit = clampLimit(options?.limit);
  const products = await getTrendingProducts({
    limit,
    topCategory: options?.topCategory,
    subCategory: options?.subCategory,
  });

  return buildRecommendationResult({
    actor,
    surface: "TRENDING",
    algorithm: options?.topCategory || options?.subCategory ? "trending_category_v1" : "trending_global_v1",
    products,
    reason: options?.topCategory || options?.subCategory ? "category-trending" : "global-trending",
    context: {
      topCategory: normalizeTopCategoryValue(options?.topCategory),
      subCategory: normalizeCategoryValue(options?.subCategory),
    },
  });
}

export async function getPopularInCategoryRecommendations(actor: RecommendationActor, options?: RecommendationOptions) {
  const limit = clampLimit(options?.limit);
  const products = await getTrendingProducts({
    limit,
    topCategory: options?.topCategory,
    subCategory: options?.subCategory,
  });

  return buildRecommendationResult({
    actor,
    surface: "POPULAR_IN_CATEGORY",
    algorithm: "popular_category_v1",
    products,
    reason: "popular-in-category",
    context: {
      topCategory: normalizeTopCategoryValue(options?.topCategory),
      subCategory: normalizeCategoryValue(options?.subCategory),
    },
  });
}

export async function getSimilarItemRecommendations(actor: RecommendationActor, productId: string, options?: RecommendationOptions) {
  const limit = clampLimit(options?.limit, 12, 32);
  const seed = await prisma.product.findFirst({
    where: {
      id: productId,
      ...ACTIVE_PRODUCT_WHERE,
    },
    include: productInclude,
  });

  if (!seed) {
    return buildRecommendationResult({
      actor,
      surface: "SIMILAR_ITEMS",
      algorithm: "similar_content_v1",
      products: [],
      reason: "seed-missing",
      context: { seedProductId: productId },
    });
  }

  const minPrice = Math.floor(seed.pricePkr * 0.65);
  const maxPrice = Math.ceil(seed.pricePkr * 1.35);
  const productById = new Map<string, RecommendationProduct>();
  const sourceScores = new Map<string, number>();
  const seedFabricTerms = tokenizeSearchQuery(`${seed.detail?.fabricComposition || ""} ${seed.detail?.materialDetails || ""}`).slice(0, 4);
  const seedFit = normalizeTokenValue(seed.fit);
  const fitSeasonFilters: Prisma.ProductWhereInput[] = [];
  if (seed.fit) fitSeasonFilters.push({ fit: seed.fit });
  if (seed.season) fitSeasonFilters.push({ season: seed.season });

  const [sameSubCategory, sameBrand, sameTopCategoryPrice, tagMatches, fitSeasonMatches, fabricMatches] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...ACTIVE_PRODUCT_WHERE,
        id: { not: seed.id },
        subcategory: seed.subcategory,
      },
      include: productInclude,
      take: 100,
    }),
    prisma.product.findMany({
      where: {
        ...ACTIVE_PRODUCT_WHERE,
        id: { not: seed.id },
        brandId: seed.brandId,
      },
      include: productInclude,
      take: 80,
    }),
    prisma.product.findMany({
      where: {
        ...ACTIVE_PRODUCT_WHERE,
        id: { not: seed.id },
        category: seed.category,
        pricePkr: {
          gte: minPrice,
          lte: maxPrice,
        },
      },
      include: productInclude,
      take: 80,
    }),
    seed.tags.length
      ? prisma.product.findMany({
          where: {
            ...ACTIVE_PRODUCT_WHERE,
            id: { not: seed.id },
            tags: { hasSome: seed.tags.slice(0, 8) },
          },
          include: productInclude,
          take: 60,
        })
      : Promise.resolve([] as RecommendationProduct[]),
    fitSeasonFilters.length
      ? prisma.product.findMany({
          where: {
            ...ACTIVE_PRODUCT_WHERE,
            id: { not: seed.id },
            category: seed.category,
            OR: fitSeasonFilters,
          },
          include: productInclude,
          take: 70,
        })
      : Promise.resolve([] as RecommendationProduct[]),
    seedFabricTerms.length
      ? prisma.product.findMany({
          where: {
            ...ACTIVE_PRODUCT_WHERE,
            id: { not: seed.id },
            OR: seedFabricTerms.map((term) => ({
              searchDocument: { contains: term, mode: "insensitive" },
            })),
          },
          include: productInclude,
          take: 60,
        })
      : Promise.resolve([] as RecommendationProduct[]),
  ]);

  addSourceProducts(productById, sourceScores, sameSubCategory, 3.5);
  addSourceProducts(productById, sourceScores, sameBrand, 1.6);
  addSourceProducts(productById, sourceScores, sameTopCategoryPrice, 1.8);
  addSourceProducts(productById, sourceScores, tagMatches, 1.2);
  addSourceProducts(productById, sourceScores, fitSeasonMatches, 1.1);
  addSourceProducts(productById, sourceScores, fabricMatches, 0.9);

  if (productById.size < limit * 2) {
    const categoryPopular = await getTrendingProducts({
      limit: limit * 2,
      topCategory: genderToLegacyTopCategory(seed.gender),
      subCategory: seed.category,
      excludeProductIds: [seed.id],
    });
    addSourceProducts(productById, sourceScores, categoryPopular, 0.9);
  }

  const candidates = [...productById.values()];
  const { popularityByProductId, popularityBaseline } = await getPopularityMaps(candidates.map((item) => item.id));
  const now = Date.now();
  const seedTagSet = new Set(seed.tags.map((tag) => normalizeComparison(tag)));
  const seedColorVal = seed.primaryColor || seed.colors?.[0] || "";
  const seedColor = normalizeComparison(seedColorVal);
  const seedSizeSet = new Set(seed.sizes.map((size) => normalizeTokenValue(size)).filter(Boolean));

  const scored = candidates
    .filter((candidate) => candidate.id !== seed.id)
    .map((candidate) => {
      let score = sourceScores.get(candidate.id) || 0;
      const candidateColorVal = candidate.primaryColor || candidate.colors?.[0] || "";
      if (candidate.subcategory && candidate.subcategory === seed.subcategory) score += 2.4;
      if (candidate.category === seed.category) score += 1.1;
      if (candidate.brandId === seed.brandId) score += 1.4;
      if (seedColor && normalizeComparison(candidateColorVal) === seedColor) score += 0.45;
      if (seedFit && normalizeTokenValue(candidate.fit) === seedFit) score += 0.45;
      if (seed.season && candidate.season === seed.season) score += 0.25;
      const sizeOverlap = (candidate.sizes || []).filter((size) => seedSizeSet.has(normalizeTokenValue(size) || "")).length;
      score += Math.min(sizeOverlap, 4) * 0.12;
      const tagOverlap = (candidate.tags || []).filter((tag) => seedTagSet.has(normalizeComparison(tag))).length;
      score += Math.min(tagOverlap, 5) * 0.25;
      const candidateFabricText = normalizeComparison(`${candidate.detail?.fabricComposition || ""} ${candidate.detail?.materialDetails || ""} ${candidate.searchDocument || ""}`);
      for (const term of seedFabricTerms) {
        if (candidateFabricText.includes(term)) score += 0.16;
      }
      score += calculatePriceSimilarity(candidate.pricePkr, seed.pricePkr) * 1.2;
      const popularity = popularityByProductId.get(candidate.id) || 0;
      score += (popularity / popularityBaseline) * 0.9;
      const ageDays = (now - candidate.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays <= 30) score += 0.25;
      if (candidate.reviewAggregate && candidate.reviewAggregate.totalReviews > 0) {
        score += (candidate.reviewAggregate.averageRating / 5) * 0.45;
      }
      return { product: candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = diversifyProducts(scored, limit);
  if (selected.length < limit) {
    const strictSubCategoryFallback = await getTrendingProducts({
      limit: limit - selected.length,
      topCategory: genderToLegacyTopCategory(seed.gender),
      subCategory: seed.category,
      excludeProductIds: [seed.id, ...selected.map((item) => item.id)],
      allowFallback: false,
    });
    selected.push(...strictSubCategoryFallback);
  }

  if (selected.length < limit) {
    const strictCategoryFallback = await getTrendingProducts({
      limit: limit - selected.length,
      topCategory: genderToLegacyTopCategory(seed.gender),
      excludeProductIds: [seed.id, ...selected.map((item) => item.id)],
      allowFallback: false,
    });
    selected.push(...strictCategoryFallback);
  }

  return buildRecommendationResult({
    actor,
    surface: "SIMILAR_ITEMS",
    algorithm: "similar_content_v1",
    products: selected,
    reason: "content-similarity",
    context: {
      seedProductId: seed.id,
      topCategory: genderToLegacyTopCategory(seed.gender),
      subCategory: seed.category,
      brandId: seed.brandId,
      pricePkr: seed.pricePkr,
    },
  });
}

export async function getRecommendationQualityMetrics(days = 30) {
  const windowDays = Math.min(Math.max(Math.floor(days), 1), 180);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [
    impressionsServed,
    recommendationClicks,
    impressionsByAlgorithm,
    impressionsBySurface,
    recentAttributedActivities,
    recentBusinessActivities,
    recentImpressions,
  ] =
    await Promise.all([
      prisma.recommendationImpression.count({ where: { createdAt: { gte: since } } }),
      prisma.recommendationClick.count({ where: { createdAt: { gte: since } } }),
      prisma.recommendationImpression.groupBy({
        by: ["algorithm"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.recommendationImpression.groupBy({
        by: ["surface"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.userActivity.findMany({
        where: {
          createdAt: { gte: since },
          eventType: {
            in: [
              UserActivityEventType.PRODUCT_ADDED_TO_CART,
              UserActivityEventType.WISHLIST_ADDED,
              UserActivityEventType.PRODUCT_PURCHASED,
              UserActivityEventType.CHECKOUT_STARTED,
              UserActivityEventType.ORDER_PLACED,
              UserActivityEventType.PRODUCT_RETURNED,
              UserActivityEventType.PRODUCT_CANCELLED,
              UserActivityEventType.RECOMMENDATION_CLICK,
              UserActivityEventType.EXPLICIT_PRODUCT_INTEREST,
            ],
          },
        },
        select: {
          eventType: true,
          metadata: true,
        },
        take: 20_000,
      }),
      prisma.userActivity.findMany({
        where: {
          createdAt: { gte: since },
          eventType: {
            in: [
              UserActivityEventType.CHECKOUT_STARTED,
              UserActivityEventType.ORDER_PLACED,
              UserActivityEventType.PRODUCT_PURCHASED,
              UserActivityEventType.PRODUCT_RETURNED,
              UserActivityEventType.PRODUCT_CANCELLED,
            ],
          },
        },
        select: {
          eventType: true,
          metadata: true,
        },
        take: 20_000,
      }),
      prisma.recommendationImpression.findMany({
        where: { createdAt: { gte: since } },
        select: { productIds: true },
        orderBy: { createdAt: "desc" },
        take: 5_000,
      }),
    ]);

  const attributedActivities = recentAttributedActivities.filter((activity) =>
    activity.eventType === UserActivityEventType.RECOMMENDATION_CLICK || hasRecommendationAttribution(activity.metadata),
  );

  const attributedAddToCart = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.PRODUCT_ADDED_TO_CART,
  ).length;
  const attributedWishlistAdds = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.WISHLIST_ADDED,
  ).length;
  const attributedPurchases = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.PRODUCT_PURCHASED,
  ).length;
  const attributedCheckoutStarted = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.CHECKOUT_STARTED,
  ).length;
  const attributedOrdersPlaced = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.ORDER_PLACED,
  ).length;
  const attributedReturns = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.PRODUCT_RETURNED,
  ).length;
  const attributedCancellations = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.PRODUCT_CANCELLED,
  ).length;
  const explicitInterestSignals = attributedActivities.filter(
    (activity) => activity.eventType === UserActivityEventType.EXPLICIT_PRODUCT_INTEREST,
  ).length;
  const businessCount = (eventType: UserActivityEventType) =>
    recentBusinessActivities.filter((activity) => activity.eventType === eventType).length;
  const orderActivities = recentBusinessActivities.filter((activity) => activity.eventType === UserActivityEventType.ORDER_PLACED);
  const totalOrderValuePkr = orderActivities.reduce(
    (total, activity) => total + (getMetadataNumber(activity.metadata, "totalPkr") || 0),
    0,
  );

  const impressionProductIds = recentImpressions.flatMap((impression) => impression.productIds);
  const uniqueImpressionProductIds = Array.from(new Set(impressionProductIds));
  const impressionProducts = uniqueImpressionProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: uniqueImpressionProductIds } },
        select: {
          id: true,
          brandId: true,
          category: true,
          subcategory: true,
          stock: true,
          isActive: true,
          approvalStatus: true,
          createdAt: true,
        },
      })
    : [];
  const productById = new Map(impressionProducts.map((product) => [product.id, product]));
  const uniqueBrandIds = new Set<string>();
  const uniqueTopCategories = new Set<string>();
  const uniqueSubCategories = new Set<string>();
  let unavailableRecommendationExposures = 0;
  let newProductExposures = 0;
  const newProductSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const productId of impressionProductIds) {
    const product = productById.get(productId);
    if (!product || !product.isActive || product.approvalStatus !== "APPROVED" || product.stock <= 0) {
      unavailableRecommendationExposures += 1;
      continue;
    }

    uniqueBrandIds.add(product.brandId);
    if (product.category) uniqueTopCategories.add(product.category);
    if (product.subcategory) uniqueSubCategories.add(product.subcategory);
    if (product.createdAt >= newProductSince) newProductExposures += 1;
  }

  return {
    windowDays,
    impressionsServed,
    recommendationClicks,
    clickThroughRate: impressionsServed ? recommendationClicks / impressionsServed : 0,
    attributedAddToCart,
    attributedWishlistAdds,
    attributedPurchases,
    attributedCheckoutStarted,
    attributedOrdersPlaced,
    attributedReturns,
    attributedCancellations,
    explicitInterestSignals,
    addToCartRate: impressionsServed ? attributedAddToCart / impressionsServed : 0,
    purchaseConversionRate: impressionsServed ? attributedPurchases / impressionsServed : 0,
    checkoutStartRate: impressionsServed ? attributedCheckoutStarted / impressionsServed : 0,
    orderPlacementRate: impressionsServed ? attributedOrdersPlaced / impressionsServed : 0,
    impressionsByAlgorithm: impressionsByAlgorithm.map((item) => ({
      algorithm: item.algorithm,
      impressions: item._count._all,
    })),
    impressionsBySurface: impressionsBySurface.map((item) => ({
      surface: item.surface,
      impressions: item._count._all,
    })),
    businessMetrics: {
      checkoutStarted: businessCount(UserActivityEventType.CHECKOUT_STARTED),
      ordersPlaced: businessCount(UserActivityEventType.ORDER_PLACED),
      productsPurchased: businessCount(UserActivityEventType.PRODUCT_PURCHASED),
      productsReturned: businessCount(UserActivityEventType.PRODUCT_RETURNED),
      productsCancelled: businessCount(UserActivityEventType.PRODUCT_CANCELLED),
      totalOrderValuePkr,
      averageOrderValuePkr: orderActivities.length ? totalOrderValuePkr / orderActivities.length : 0,
    },
    marketplaceHealth: {
      sampledImpressions: recentImpressions.length,
      sampledRecommendationProducts: impressionProductIds.length,
      uniqueRecommendedProducts: uniqueImpressionProductIds.length,
      uniqueBrands: uniqueBrandIds.size,
      uniqueTopCategories: uniqueTopCategories.size,
      uniqueSubCategories: uniqueSubCategories.size,
      brandDiversityRate: impressionProductIds.length ? uniqueBrandIds.size / impressionProductIds.length : 0,
      categoryDiversityRate: impressionProductIds.length ? uniqueTopCategories.size / impressionProductIds.length : 0,
      unavailableExposureRate: impressionProductIds.length ? unavailableRecommendationExposures / impressionProductIds.length : 0,
      newProductExposureRate: impressionProductIds.length ? newProductExposures / impressionProductIds.length : 0,
    },
  };
}
