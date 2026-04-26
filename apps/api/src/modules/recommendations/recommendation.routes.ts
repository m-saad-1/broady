import { Router } from "express";
import { UserActivityEventType } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { getForYouRecommendations, trackUserActivity } from "./recommendation.service.js";

const router = Router();

const recommendationEventSchema = z
  .object({
    eventType: z.nativeEnum(UserActivityEventType),
    productId: z.string().trim().min(1).optional(),
    searchQuery: z.string().trim().max(200).optional(),
    topCategory: z.string().trim().max(50).optional(),
    subCategory: z.string().trim().max(80).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.eventType === UserActivityEventType.PRODUCT_VIEW ||
        value.eventType === UserActivityEventType.PRODUCT_ADDED_TO_CART ||
        value.eventType === UserActivityEventType.PRODUCT_PURCHASED ||
        value.eventType === UserActivityEventType.WISHLIST_ADDED) &&
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
  });

router.get("/for-you", requireAuth, async (req, res) => {
  const limitRaw = Number(req.query.limit || 16);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 40) : 16;

  const products = await getForYouRecommendations(req.auth!.userId, { limit });
  return res.json({ data: products });
});

router.post("/events", requireAuth, async (req, res) => {
  const parsed = recommendationEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  await trackUserActivity({
    userId: req.auth!.userId,
    eventType: parsed.data.eventType,
    productId: parsed.data.productId,
    searchQuery: parsed.data.searchQuery,
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
    metadata: parsed.data.metadata,
  });

  return res.status(202).json({ accepted: true });
});

export default router;
