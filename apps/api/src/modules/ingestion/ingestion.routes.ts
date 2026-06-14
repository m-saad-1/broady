import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import { approveProduct, enqueueImport, rejectProduct, retryImport } from "./services/ingestion.service.js";
import { getIngestionQueueMetrics } from "./queues/ingestion.queue-metrics.js";
import { inventorySyncQueue } from "./queues/ingestion.queues.js";

const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["application/json", "text/csv", "application/vnd.ms-excel", "text/plain"];
    if (!allowed.includes(file.mimetype)) {
      callback(new Error("Only JSON/CSV/text payloads are allowed"));
      return;
    }
    callback(null, true);
  },
});
const router = Router();

router.use(requireAuth, requireAdmin);

router.post("/imports", upload.single("file"), async (req, res) => {
  try {
    const bodySchema = z.object({
      brandId: z.string().min(1),
      sourceType: z.enum(["SHOPIFY_JSON", "WOOCOMMERCE_JSON", "CUSTOM_JSON", "CSV", "REST_API", "MANUAL_UPLOAD"]),
      sourceLabel: z.string().optional(),
      sourceLocation: z.string().optional(),
      rawText: z.string().optional(),
    });

    const parsedBody = bodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsedBody.error.flatten() });
    }

    let rawJson: unknown;
    if (req.body?.rawJson) {
      try {
        rawJson = JSON.parse(String(req.body.rawJson));
      } catch {
        return res.status(400).json({ message: "rawJson must be valid JSON" });
      }
    }

    const job = await enqueueImport({
      brandId: parsedBody.data.brandId,
      sourceType: parsedBody.data.sourceType,
      sourceLabel: parsedBody.data.sourceLabel,
      sourceLocation: parsedBody.data.sourceLocation,
      rawText: parsedBody.data.rawText,
      rawJson,
      fileBuffer: req.file?.buffer,
    });

    return res.status(202).json({ data: job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enqueue import";
    return res.status(503).json({ message });
  }
});

router.get("/imports/:importJobId", async (req, res) => {
  try {
    const importJobId = String(req.params.importJobId);
    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        logs: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    });

    if (!job) return res.status(404).json({ message: "Import job not found" });
    return res.json({ data: job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch import job";
    return res.status(503).json({ message });
  }
});

router.get("/imports/:importJobId/failed-products", async (req, res) => {
  try {
    const importJobId = String(req.params.importJobId);
    const logs = await prisma.importLog.findMany({
      where: { importJobId, level: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return res.json({
      data: logs.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        code: entry.code,
        message: entry.message,
        details: entry.details,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch failed products";
    return res.status(503).json({ message });
  }
});

router.get("/imports", async (_req, res) => {
  try {
    const jobs = await prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        logs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      take: 100,
    });
    return res.json({ data: jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch import jobs";
    return res.status(503).json({ message });
  }
});

router.get("/queues/metrics", async (_req, res) => {
  try {
    const metrics = await getIngestionQueueMetrics();
    return res.json({ data: metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch queue metrics";
    return res.status(503).json({ message });
  }
});

router.post("/imports/:importJobId/retry", async (req, res) => {
  try {
    const importJobId = String(req.params.importJobId);
    const updated = await retryImport(importJobId);
    return res.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry import";
    return res.status(503).json({ message });
  }
});

router.delete("/imports/:importJobId", async (req, res) => {
  try {
    const importJobId = String(req.params.importJobId);
    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
      select: { id: true, status: true },
    });

    if (!job) return res.status(404).json({ message: "Import job not found" });
    if (job.status === "PROCESSING") {
      return res.status(409).json({ message: "Cannot delete an import while it is processing." });
    }

    await prisma.importJob.delete({ where: { id: importJobId } });
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete import job";
    return res.status(503).json({ message });
  }
});

router.patch("/products/:productId/fix", async (req, res) => {
  try {
    const bodySchema = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        gender: z.enum(["men", "women", "boys", "girls"]).optional(),
        topCategory: z.string().min(1).optional(),
        subCategory: z.string().min(1).optional(),
        division: z.enum(["top", "bottom", "footwear", "accessory"]).optional(),
        category: z.string().min(1).optional(),
        subType: z.string().min(1).optional(),
        color: z.string().min(1).optional(),
        pricePkr: z.number().int().nonnegative().optional(),
        stock: z.number().int().nonnegative().optional(),
        sizes: z.array(z.string().min(1)).optional(),
        tags: z.array(z.string()).optional(),
        imageUrl: z.string().url().optional(),
        metadata: z.record(z.any()).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

    const parsedBody = bodySchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsedBody.error.flatten() });
    }

    const productId = String(req.params.productId);
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return res.status(404).json({ message: "Product not found" });

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...parsedBody.data,
        approvalStatus: "PENDING",
        isActive: false,
        mappingStatus: parsedBody.data.category || parsedBody.data.division || parsedBody.data.gender ? "complete" : existing.mappingStatus,
        resolutionSource: "admin_manual",
        metadata: parsedBody.data.metadata as any,
      },
    });

    return res.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fix product";
    return res.status(503).json({ message });
  }
});

router.post("/products/:productId/inventory-sync", async (req, res) => {
  try {
    const productId = String(req.params.productId);
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    let queued = true;
    try {
      await inventorySyncQueue.add("manual-inventory-sync", { productId });
    } catch {
      queued = false;
    }

    await prisma.inventory.updateMany({
      where: { productId },
      data: { syncState: "PENDING" },
    });

    return res.status(202).json({ data: { queued, productId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync inventory";
    return res.status(503).json({ message });
  }
});

router.post("/products/:productId/approve", async (req, res) => {
  try {
    const productId = String(req.params.productId);
    const updated = await approveProduct(productId, req.auth!.userId);
    return res.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve product";
    return res.status(503).json({ message });
  }
});

router.post("/products/:productId/reject", async (req, res) => {
  try {
    const payload = z.object({ reason: z.string().min(1).max(500) }).safeParse(req.body || {});
    if (!payload.success) return res.status(400).json({ message: "Reason is required" });

    const productId = String(req.params.productId);
    const updated = await rejectProduct(productId, req.auth!.userId, payload.data.reason);
    return res.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reject product";
    return res.status(503).json({ message });
  }
});

router.get("/approvals/pending", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { approvalStatus: "PENDING", deletedAt: null },
      include: {
        brand: true,
        variants: true,
        images: true,
        detail: true,
        shipping: true,
        seo: true,
        importMeta: true,
        importRawData: { orderBy: { createdAt: "desc" }, take: 1 },
        approvals: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return res.json({ data: products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch pending approvals";
    return res.status(503).json({ message });
  }
});

router.get("/approvals/pending/:productId", async (req, res) => {
  try {
    const productId = String(req.params.productId);
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        brand: true,
        variants: true,
        images: true,
        detail: true,
        shipping: true,
        seo: true,
        importMeta: true,
        importRawData: { orderBy: { createdAt: "desc" }, take: 1 },
        approvals: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json({ data: product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch product";
    return res.status(503).json({ message });
  }
});

export default router;
