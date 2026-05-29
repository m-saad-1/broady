import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  productStructureInclude,
  updateProduct,
} from "./product.service.js";
import {
  inferSearchFilters,
  normalizeSearchInput,
} from "./products.search-utils.js";
import {
  isMeilisearchProductSearchEnabled,
  runMeilisearchProductSuggest,
} from "./products.meilisearch-search.js";
import { productBaseSchema } from "./product.validation.js";
import { z } from "zod";

const router = Router();

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const brandId = typeof req.body?.brandId === "string" && req.body.brandId.trim() ? req.body.brandId.trim() : req.auth!.brandId;
    if (!brandId) {
      return res.status(400).json({ message: "Brand is required" });
    }

    const product = await createProduct(req.body, brandId);
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const products = await listProducts(req.query);
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.get("/suggest", async (req, res, next) => {
  try {
    const rawQuery = getParamValue(req.query.q as string | undefined) || "";
    const normalized = normalizeSearchInput(rawQuery);
    if (!normalized || normalized.length < 2) {
      return res.json({ data: [] });
    }

    const inferred = inferSearchFilters(normalized);
    const topCategory = getParamValue(req.query.topCategory as string | undefined);
    const juniorCategory = getParamValue(req.query.juniorCategory as string | undefined);
    const suggestions = isMeilisearchProductSearchEnabled()
      ? await runMeilisearchProductSuggest(normalized, {
          gender: inferred.gender,
          topCategory: topCategory || (inferred.gender === "Juniors" ? "Juniors" : undefined),
          juniorCategory: juniorCategory || inferred.juniorCategory,
          productType: inferred.productType,
          subCategory: inferred.subCategory,
          color: inferred.color,
          size: inferred.size,
        })
      : [];

    const correctedQuery =
      inferred.subCategory && !normalized.toLowerCase().includes(inferred.subCategory.toLowerCase())
        ? inferred.subCategory
        : undefined;

    res.json({ data: suggestions, correctedQuery });
  } catch (error) {
    next(error);
  }
});

router.get("/admin", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        approvalStatus: { not: "REJECTED" },
      },
      include: productStructureInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = getParamValue(req.params.id);
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
      include: { ...productStructureInclude, approvals: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.get("/approval/pending", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { approvalStatus: "PENDING" },
      include: productStructureInclude,
      orderBy: { updatedAt: "desc" },
    });
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.get("/templates", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const templates = await prisma.productContentTemplate.findMany({
      where: type ? { type: type as any } : undefined,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
});

router.post("/templates", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const payload = z
      .object({
        type: z.enum(["SIZE_GUIDE", "DELIVERIES_RETURNS", "SHIPPING_DELIVERY", "FABRIC_CARE"]),
        name: z.string().trim().min(1).max(120),
        content: z.any(),
      })
      .safeParse(req.body || {});

    if (!payload.success) {
      return res.status(400).json({ message: "Invalid template payload", issues: payload.error.flatten() });
    }

    const template = await prisma.productContentTemplate.create({
      data: {
        type: payload.data.type,
        name: payload.data.name,
        content: payload.data.content,
        createdById: req.auth!.userId,
      },
    });

    res.status(201).json({ data: template });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/approval", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = getParamValue(req.params.id);
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const approvalStatus = String(req.body?.approvalStatus || "").toUpperCase();
    if (approvalStatus !== "APPROVED" && approvalStatus !== "REJECTED") {
      return res.status(400).json({ message: "approvalStatus must be APPROVED or REJECTED" });
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        approvalStatus,
        isActive: approvalStatus === "APPROVED",
        approvalReviewedAt: new Date(),
        approvalReviewedById: req.auth!.userId,
      },
      include: productStructureInclude,
    });

    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const idOrSlug = getParamValue(req.params.id);
    if (!idOrSlug) {
      return res.status(400).json({ message: "Product id or slug is required" });
    }

    let product = await getProductById(idOrSlug);
    if (!product) {
      product = await getProductBySlug(idOrSlug);
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = getParamValue(req.params.id);
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await updateProduct(productId, req.body);
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = getParamValue(req.params.id);
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    await deleteProduct(productId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
