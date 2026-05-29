import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../config/prisma.js";
import { enqueueImport, retryImport } from "./services/ingestion.service.js";

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

async function getBrandAccess(userId: string, directBrandId?: string | null) {
  if (directBrandId) {
    const brand = await prisma.brand.findUnique({ where: { id: directBrandId }, select: { id: true, name: true, slug: true } });
    if (brand) return { brandId: brand.id, brand };
  }

  const membership = await prisma.brandMember.findFirst({
    where: { userId },
    include: { brand: { select: { id: true, name: true, slug: true } } },
  });

  if (!membership) return null;
  return { brandId: membership.brandId, brand: membership.brand };
}

router.use(requireAuth);

router.post("/imports", upload.single("file"), async (req, res) => {
  try {
    const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
    if (!access) return res.status(403).json({ message: "Brand access required" });

    const bodySchema = z.object({
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
      brandId: access.brandId,
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

router.get("/imports", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const jobs = await prisma.importJob.findMany({
    where: { brandId: access.brandId },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    take: 200,
  });

  return res.json({ data: jobs });
});

router.get("/imports/:importJobId", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const importJobId = String(req.params.importJobId);
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, brandId: access.brandId },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });

  if (!job) return res.status(404).json({ message: "Import job not found" });
  return res.json({ data: job });
});

router.post("/imports/:importJobId/retry", async (req, res) => {
  try {
    const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
    if (!access) return res.status(403).json({ message: "Brand access required" });

    const importJobId = String(req.params.importJobId);
    const job = await prisma.importJob.findFirst({ where: { id: importJobId, brandId: access.brandId } });
    if (!job) return res.status(404).json({ message: "Import job not found" });

    const updated = await retryImport(importJobId);
    return res.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry import";
    return res.status(503).json({ message });
  }
});

router.delete("/imports/:importJobId", async (req, res) => {
  try {
    const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
    if (!access) return res.status(403).json({ message: "Brand access required" });

    const importJobId = String(req.params.importJobId);
    const job = await prisma.importJob.findFirst({
      where: { id: importJobId, brandId: access.brandId },
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

router.get("/products/pending-fixes", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const statusFilter = z.enum(["PENDING", "REJECTED"]).optional().safeParse(req.query.status);
  const approvalStatuses = statusFilter.success && statusFilter.data ? [statusFilter.data] : ["PENDING", "REJECTED"];

  const products = await prisma.product.findMany({
    where: { brandId: access.brandId, approvalStatus: { in: approvalStatuses as any }, deletedAt: null },
    include: { variants: true, images: true, detail: true, shipping: true, seo: true, importMeta: true, approvals: { orderBy: { createdAt: "desc" }, take: 3 } },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ data: products });
});

router.get("/products/pending-fixes/:productId", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const productId = String(req.params.productId);
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      brandId: access.brandId,
      deletedAt: null,
    },
    include: { variants: true, images: true, detail: true, shipping: true, seo: true, importMeta: true, approvals: { orderBy: { createdAt: "desc" }, take: 3 } },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });
  return res.json({ data: product });
});

router.patch("/products/:productId/fix", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId, req.auth!.brandId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const bodySchema = z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      topCategory: z.string().min(1).optional(),
      subCategory: z.string().min(1).optional(),
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
  const product = await prisma.product.findFirst({ where: { id: productId, brandId: access.brandId } });
  if (!product) return res.status(404).json({ message: "Product not found" });

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...parsedBody.data,
      approvalStatus: "PENDING",
      isActive: false,
      metadata: parsedBody.data.metadata as any,
    },
  });

  return res.json({ data: updated });
});

export default router;
