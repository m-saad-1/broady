import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { cache } from "../../config/cache.js";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import { productCache } from "./product-cache.service.js";
import {
  productApprovalStatuses,
  productBaseSchema,
  productDeliveriesReturnsSchema,
  productFabricCareSchema,
  productShippingDeliverySchema,
  productSizeGuideSchema,
  productTemplateTypes,
} from "./product.validation.js";
import {
  isMeilisearchProductSearchEnabled,
  runMeilisearchProductSearch,
} from "./products.meilisearch-search.js";
import {
  expandCatalogTopCategory,
  buildPrefixTsQuery,
  colorWords,
  detectTopCategoryToken,
  inferQueryCategory,
  inferSubCategoryHints,
  normalizeSearchInput,
  subCategoryHintMap,
  tokenizeSearchQuery,
} from "./products.search-utils.js";

import productController from "./product.controller.js";
const router = Router();
router.use("/", productController);

export default router;
