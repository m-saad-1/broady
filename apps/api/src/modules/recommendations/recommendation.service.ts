import { Prisma, UserActivityEventType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { getRedisClient } from "../../config/redis.js";

type TrackUserActivityInput = {
  userId: string;
  eventType: UserActivityEventType;
  productId?: string;
  searchQuery?: string;
  topCategory?: string;
  subCategory?: string;
  metadata?: Record<string, unknown>;
};

type RecommendationOptions = {
  limit?: number;
};

const ACTIVITY_WEIGHTS: Record<UserActivityEventType, number> = {
  PRODUCT_VIEW: 1,
  PRODUCT_ADDED_TO_CART: 3,
  PRODUCT_PURCHASED: 5,
  SEARCH_QUERY: 2,
  CATEGORY_BROWSE: 2,
  WISHLIST_ADDED: 1.5,
};

const RECOMMENDATION_CACHE_TTL_SECONDS = 10 * 60;
const FALLBACK_CACHE_TTL_SECONDS = 5 * 60;

const metrics = {
  eventsTracked: 0,
  eventsSkippedValidation: 0,
  eventsSkippedDuplicate: 0,
  recommendationRequests: 0,
  recommendationCacheHits: 0,
  recommendationCacheMisses: 0,
  fallbackCacheHits: 0,
  fallbackCacheMisses: 0,
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
  });
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
  if (!query) return [];
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}

function calculatePriceSimilarity(price: number, medianSeedPrice: number | null) {
  if (!medianSeedPrice || medianSeedPrice <= 0) return 0;
  const delta = Math.abs(price - medianSeedPrice);
  const normalized = Math.max(0, 1 - delta / medianSeedPrice);
  return normalized;
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

function normalizeCategoryValue(value?: string | null) {
  const normalized = (value || "").trim();
  return normalized || null;
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

async function bumpRecommendationVersion(userId: string) {
  try {
    await getRedisClient().incr(`recommendations:version:${userId}`);
  } catch {
    // Ignore cache version failures.
  }
}

async function getRecommendationVersion(userId: string) {
  try {
    const value = await getRedisClient().get(`recommendations:version:${userId}`);
    return value || "0";
  } catch {
    return "0";
  }
}

export async function trackUserActivity(input: TrackUserActivityInput) {
  const searchQuery = input.searchQuery?.trim();
  const topCategory = normalizeCategoryValue(input.topCategory);
  const subCategory = normalizeCategoryValue(input.subCategory);

  if (input.eventType === UserActivityEventType.SEARCH_QUERY && !searchQuery) {
    metrics.eventsSkippedValidation += 1;
    maybeLogMetrics("skip-invalid-event");
    return;
  }

  if (input.eventType === UserActivityEventType.CATEGORY_BROWSE && !topCategory && !subCategory) {
    metrics.eventsSkippedValidation += 1;
    maybeLogMetrics("skip-invalid-event");
    return;
  }

  // Skip duplicate view/cart events in a short window to avoid noisy data.
  if (
    input.eventType === UserActivityEventType.PRODUCT_VIEW ||
    input.eventType === UserActivityEventType.PRODUCT_ADDED_TO_CART
  ) {
    const duplicateWindowMinutes = input.eventType === UserActivityEventType.PRODUCT_VIEW ? 20 : 10;
    const duplicate = await prisma.userActivity.findFirst({
      where: {
        userId: input.userId,
        eventType: input.eventType,
        productId: input.productId,
        createdAt: {
          gte: new Date(Date.now() - duplicateWindowMinutes * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      metrics.eventsSkippedDuplicate += 1;
      maybeLogMetrics("skip-duplicate-event");
      return;
    }
  }

  await prisma.userActivity.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      productId: input.productId,
      searchQuery,
      topCategory,
      subCategory,
      weight: ACTIVITY_WEIGHTS[input.eventType],
      metadata: input.metadata,
    },
  });

  metrics.eventsTracked += 1;
  if (metrics.eventsTracked % 25 === 0) {
    maybeLogMetrics("events-tracked-batch", true);
  } else {
    maybeLogMetrics("event-tracked");
  }

  await bumpRecommendationVersion(input.userId);
}

async function getFallbackProducts(limit: number, excludeProductIds: string[] = []) {
  const cacheKey = `recommendations:fallback:${limit}`;
  const cached = await readRedisJson<string[]>(cacheKey);
  if (cached?.length) {
    metrics.fallbackCacheHits += 1;
    maybeLogMetrics("fallback-cache-hit");
    const products = await prisma.product.findMany({
      where: {
        id: { in: cached.filter((id) => !excludeProductIds.includes(id)) },
        isActive: true,
        approvalStatus: "APPROVED",
      },
      include: {
        brand: true,
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    return cached
      .filter((id) => !excludeProductIds.includes(id))
      .map((id) => productById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, limit);
  }

  metrics.fallbackCacheMisses += 1;
  maybeLogMetrics("fallback-cache-miss");

  const [topPurchased, topViewed, latest, topRated] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 120,
    }),
    prisma.userActivity.groupBy({
      by: ["productId"],
      where: {
        eventType: UserActivityEventType.PRODUCT_VIEW,
        productId: { not: null },
        createdAt: { gte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
      },
      _sum: { weight: true },
      orderBy: { _sum: { weight: "desc" } },
      take: 120,
    }),
    prisma.product.findMany({
      where: { isActive: true, approvalStatus: "APPROVED" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.productReviewAggregate.findMany({
      where: {
        totalReviews: { gt: 0 },
        product: { isActive: true, approvalStatus: "APPROVED" },
      },
      select: { productId: true },
      orderBy: [{ averageRating: "desc" }, { totalReviews: "desc" }],
      take: 120,
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

  const products = await prisma.product.findMany({
    where: {
      id: { in: dedupedIds },
      isActive: true,
      approvalStatus: "APPROVED",
    },
    include: {
      brand: true,
      reviewAggregate: true,
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const ordered = dedupedIds
    .map((id) => productById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, limit);

  await writeRedisJson(cacheKey, ordered.map((item) => item.id), FALLBACK_CACHE_TTL_SECONDS);

  return ordered;
}

export async function getForYouRecommendations(userId: string, options?: RecommendationOptions) {
  metrics.recommendationRequests += 1;
  const limit = Math.min(Math.max(options?.limit || 16, 1), 40);
  const version = await getRecommendationVersion(userId);
  const cacheKey = `recommendations:user:${userId}:v:${version}:l:${limit}`;
  const cachedIds = await readRedisJson<string[]>(cacheKey);

  if (cachedIds?.length) {
    metrics.recommendationCacheHits += 1;
    maybeLogMetrics("recommendation-cache-hit");
    const products = await prisma.product.findMany({
      where: {
        id: { in: cachedIds },
        isActive: true,
        approvalStatus: "APPROVED",
      },
      include: {
        brand: true,
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const ordered = cachedIds
      .map((id) => productById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, limit);

    if (ordered.length >= Math.min(limit, 6)) {
      return ordered;
    }
  }

  metrics.recommendationCacheMisses += 1;
  maybeLogMetrics("recommendation-cache-miss");

  const activities = await prisma.userActivity.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 600,
  });

  if (!activities.length) {
    return getFallbackProducts(limit);
  }

  const seedProductScores = new Map<string, number>();
  const topCategoryScores = new Map<string, number>();
  const subCategoryScores = new Map<string, number>();
  const searchTermScores = new Map<string, number>();

  for (const activity of activities) {
    const recency = activityRecencyMultiplier(activity.createdAt);
    const weightedScore = activity.weight * recency;

    if (activity.productId) {
      seedProductScores.set(activity.productId, (seedProductScores.get(activity.productId) || 0) + weightedScore);
    }

    if (activity.topCategory) {
      topCategoryScores.set(activity.topCategory, (topCategoryScores.get(activity.topCategory) || 0) + weightedScore);
    }

    if (activity.subCategory) {
      subCategoryScores.set(activity.subCategory, (subCategoryScores.get(activity.subCategory) || 0) + weightedScore);
    }

    if (activity.searchQuery) {
      for (const token of tokenizeSearchQuery(activity.searchQuery)) {
        searchTermScores.set(token, (searchTermScores.get(token) || 0) + weightedScore);
      }
    }
  }

  const rankedSeedProductIds = [...seedProductScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([productId]) => productId)
    .slice(0, 32);

  const rankedTopCategories = [...topCategoryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
    .slice(0, 6);

  const rankedSubCategories = [...subCategoryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
    .slice(0, 10);

  const rankedSearchTerms = [...searchTermScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, 8);

  const [seedProducts, globalPopularity] = await Promise.all([
    prisma.product.findMany({
      where: {
        id: { in: rankedSeedProductIds },
      },
      include: {
        brand: true,
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 220,
    }),
  ]);

  const seedBrandIds = Array.from(new Set(seedProducts.map((item) => item.brandId))).slice(0, 8);
  const seedPrices = seedProducts.map((item) => item.pricePkr);
  const medianSeedPrice = calculateMedian(seedPrices);

  const candidateWhere: Prisma.ProductWhereInput = {
    isActive: true,
    approvalStatus: "APPROVED",
    OR: [
      rankedSeedProductIds.length ? { id: { in: rankedSeedProductIds } } : undefined,
      rankedSubCategories.length ? { subCategory: { in: rankedSubCategories } } : undefined,
      rankedTopCategories.length ? { topCategory: { in: rankedTopCategories } } : undefined,
      seedBrandIds.length ? { brandId: { in: seedBrandIds } } : undefined,
      ...rankedSearchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: "insensitive" as const } },
          { subCategory: { contains: term, mode: "insensitive" as const } },
        ],
      })),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };

  const candidates = await prisma.product.findMany({
    where: candidateWhere,
    include: {
      brand: true,
      reviewAggregate: true,
    },
    take: 260,
  });

  if (!candidates.length) {
    return getFallbackProducts(limit);
  }

  const popularityByProductId = new Map<string, number>();
  let popularityBaseline = 1;
  for (const item of globalPopularity) {
    const total = item._sum.quantity || 0;
    popularityByProductId.set(item.productId, total);
    if (total > popularityBaseline) popularityBaseline = total;
  }

  const seedSubCategorySet = new Set(seedProducts.map((item) => item.subCategory));
  const seedTopCategorySet = new Set(seedProducts.map((item) => item.topCategory));
  const seedBrandSet = new Set(seedProducts.map((item) => item.brandId));
  const now = Date.now();

  const scoredCandidates = candidates.map((candidate) => {
    let score = 0;

    const directInterest = seedProductScores.get(candidate.id) || 0;
    score += directInterest * 2;

    if (seedSubCategorySet.has(candidate.subCategory)) score += 2;
    if (seedTopCategorySet.has(candidate.topCategory)) score += 1;
    if (seedBrandSet.has(candidate.brandId)) score += 1.4;

    const topCategoryInterest = topCategoryScores.get(candidate.topCategory) || 0;
    const subCategoryInterest = subCategoryScores.get(candidate.subCategory) || 0;
    score += topCategoryInterest * 0.35 + subCategoryInterest * 0.45;

    const candidateName = candidate.name.toLowerCase();
    const candidateSubCategory = candidate.subCategory.toLowerCase();
    for (const term of rankedSearchTerms) {
      if (candidateName.includes(term)) {
        score += 1.2;
      }
      if (candidateSubCategory.includes(term)) {
        score += 0.8;
      }
    }

    score += calculatePriceSimilarity(candidate.pricePkr, medianSeedPrice);

    const popularity = popularityByProductId.get(candidate.id) || 0;
    score += (popularity / popularityBaseline) * 1.25;

    const ageDays = (now - candidate.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays <= 14) {
      score += 0.4;
    }

    if (candidate.reviewAggregate && candidate.reviewAggregate.totalReviews > 0) {
      score += (candidate.reviewAggregate.averageRating / 5) * 0.6;
    }

    return {
      product: candidate,
      score,
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  const diversified: typeof scoredCandidates = [];
  const overflow: typeof scoredCandidates = [];
  const subCategoryCount = new Map<string, number>();

  for (const entry of scoredCandidates) {
    const count = subCategoryCount.get(entry.product.subCategory) || 0;
    if (count >= 4) {
      overflow.push(entry);
      continue;
    }

    diversified.push(entry);
    subCategoryCount.set(entry.product.subCategory, count + 1);
    if (diversified.length >= limit) break;
  }

  if (diversified.length < limit) {
    for (const entry of overflow) {
      diversified.push(entry);
      if (diversified.length >= limit) break;
    }
  }

  const selected = diversified.slice(0, limit).map((entry) => entry.product);

  if (selected.length < limit) {
    const fallback = await getFallbackProducts(limit - selected.length, selected.map((item) => item.id));
    selected.push(...fallback);
  }

  await writeRedisJson(cacheKey, selected.map((item) => item.id), RECOMMENDATION_CACHE_TTL_SECONDS);

  return selected;
}
