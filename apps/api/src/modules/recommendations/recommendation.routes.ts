import type { Request } from "express";
import { Router } from "express";
import { UserActivityEventType } from "@prisma/client";
import { z } from "zod";
import { optionalAuth, requireAdmin, requireAuth } from "../../middleware/auth.js";
import {
  getForYouRecommendations,
  getPopularInCategoryRecommendations,
  getRecommendationQualityMetrics,
  getSimilarItemRecommendations,
  getTrendingRecommendations,
  mergeAnonymousRecommendationSession,
  rebuildRecommendationProfiles,
  sanitizeRecommendationSessionId,
  trackUserActivity,
} from "./recommendation.service.js";

const router = Router();
const RECOMMENDATION_SESSION_COOKIE = "broady_recommendation_session";

function getQueryString(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function getLimit(req: Request, fallback = 16) {
  const limitRaw = Number(req.query.limit || fallback);
  return Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 40) : fallback;
}

function getRecommendationActor(req: Request) {
  const headerSessionId =
    typeof req.headers["x-recommendation-session-id"] === "string"
      ? req.headers["x-recommendation-session-id"]
      : Array.isArray(req.headers["x-recommendation-session-id"])
        ? req.headers["x-recommendation-session-id"][0]
        : undefined;

  return {
    userId: req.auth?.userId,
    anonymousSessionId: sanitizeRecommendationSessionId(headerSessionId || req.cookies?.[RECOMMENDATION_SESSION_COOKIE]),
  };
}

async function prepareRecommendationActor(req: Request) {
  const actor = getRecommendationActor(req);
  await mergeAnonymousRecommendationSession(actor);
  return actor;
}

const recommendationEventSchema = z
  .object({
    eventType: z.nativeEnum(UserActivityEventType),
    productId: z.string().trim().min(1).optional(),
    variantId: z.string().trim().min(1).optional(),
    brandId: z.string().trim().min(1).optional(),
    searchQuery: z.string().trim().max(200).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    sourcePage: z.string().trim().max(120).optional(),
    device: z.string().trim().max(80).optional(),
    gender: z.string().trim().max(80).optional(),
    topCategory: z.string().trim().max(80).optional(),
    subCategory: z.string().trim().max(120).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.eventType === UserActivityEventType.PRODUCT_VIEW ||
        value.eventType === UserActivityEventType.PRODUCT_CLICK ||
        value.eventType === UserActivityEventType.PRODUCT_ADDED_TO_CART ||
        value.eventType === UserActivityEventType.PRODUCT_REMOVED_FROM_CART ||
        value.eventType === UserActivityEventType.PRODUCT_PURCHASED ||
        value.eventType === UserActivityEventType.PRODUCT_RETURNED ||
        value.eventType === UserActivityEventType.PRODUCT_CANCELLED ||
        value.eventType === UserActivityEventType.WISHLIST_ADDED ||
        value.eventType === UserActivityEventType.RECOMMENDATION_CLICK ||
        value.eventType === UserActivityEventType.EXPLICIT_PRODUCT_INTEREST) &&
      !value.productId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productId"],
        message: "productId is required for this event type",
      });
    }

    if (value.eventType === UserActivityEventType.SEARCH_QUERY && !value.searchQuery) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["searchQuery"],
        message: "searchQuery is required for SEARCH_QUERY",
      });
    }

    if (value.eventType === UserActivityEventType.CATEGORY_BROWSE && !value.topCategory && !value.subCategory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topCategory"],
        message: "topCategory or subCategory is required for CATEGORY_BROWSE",
      });
    }

    if (value.eventType === UserActivityEventType.FILTER_USED && !value.filters && !value.topCategory && !value.subCategory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filters"],
        message: "filters, topCategory, or subCategory is required for FILTER_USED",
      });
    }
  });

router.get("/for-you", optionalAuth, async (req, res) => {
  const actor = await prepareRecommendationActor(req);
  const result = await getForYouRecommendations(actor, {
    limit: getLimit(req),
    topCategory: getQueryString(req.query.topCategory),
    subCategory: getQueryString(req.query.subCategory),
  });

  return res.json({ data: result.products, meta: result.meta });
});

router.get("/trending", optionalAuth, async (req, res) => {
  const result = await getTrendingRecommendations(await prepareRecommendationActor(req), {
    limit: getLimit(req),
    topCategory: getQueryString(req.query.topCategory),
    subCategory: getQueryString(req.query.subCategory),
  });

  return res.json({ data: result.products, meta: result.meta });
});

router.get("/popular", optionalAuth, async (req, res) => {
  const result = await getPopularInCategoryRecommendations(await prepareRecommendationActor(req), {
    limit: getLimit(req),
    topCategory: getQueryString(req.query.topCategory),
    subCategory: getQueryString(req.query.subCategory),
  });

  return res.json({ data: result.products, meta: result.meta });
});

router.get("/similar/:productId", optionalAuth, async (req, res) => {
  const productId = String(req.params.productId || "").trim();
  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  const result = await getSimilarItemRecommendations(await prepareRecommendationActor(req), productId, {
    limit: getLimit(req, 12),
  });

  return res.json({ data: result.products, meta: result.meta });
});

router.get("/metrics", requireAuth, requireAdmin, async (req, res) => {
  const daysRaw = Number(req.query.days || 30);
  const days = Number.isFinite(daysRaw) ? daysRaw : 30;
  const metrics = await getRecommendationQualityMetrics(days);
  return res.json({ data: metrics });
});

router.post("/profiles/rebuild", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      limit: z.number().int().min(1).max(5_000).optional(),
      days: z.number().int().min(1).max(365).optional(),
    })
    .safeParse(req.body || {});

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const result = await rebuildRecommendationProfiles(parsed.data);
  return res.json({ data: result });
});

router.post("/events", optionalAuth, async (req, res) => {
  const parsed = recommendationEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const actor = await prepareRecommendationActor(req);
  if (!actor.userId && !actor.anonymousSessionId) {
    return res.status(400).json({ message: "A user session or recommendation session id is required." });
  }

  const result = await trackUserActivity({
    ...actor,
    eventType: parsed.data.eventType,
    productId: parsed.data.productId,
    variantId: parsed.data.variantId,
    brandId: parsed.data.brandId,
    searchQuery: parsed.data.searchQuery,
    filters: parsed.data.filters,
    sourcePage: parsed.data.sourcePage,
    device: parsed.data.device,
    gender: parsed.data.gender,
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
    metadata: parsed.data.metadata,
  });

  return res.status(202).json({ accepted: true, tracked: result.tracked, reason: result.reason });
});

export default router;
