import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";

const router = Router();

const brandCreateSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  logoUrl: z.string().url().optional(),
  description: z.string().trim().min(10).optional(),
  verified: z.boolean().optional(),
});

const brandUpdateSchema = brandCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

router.get("/", async (_req, res) => {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  res.json({ data: brands });
});

router.get("/id/:id", async (req, res) => {
  const brand = await prisma.brand.findUnique({ where: { id: String(req.params.id) } });
  if (!brand) return res.status(404).json({ message: "Brand not found" });
  return res.json({ data: brand });
});

router.get("/:slug", async (req, res) => {
  const brand = await prisma.brand.findUnique({
    where: { slug: req.params.slug },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!brand) return res.status(404).json({ message: "Brand not found" });
  return res.json({ data: brand });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = brandCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  try {
    const brand = await prisma.brand.create({ data: parsed.data });
    return res.status(201).json({ data: brand });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Brand name or slug already exists" });
    }
    throw error;
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = brandUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const brand = await prisma.brand.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
    });
    return res.json({ data: brand });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ message: "Brand not found" });
      if (error.code === "P2002") return res.status(409).json({ message: "Brand name or slug already exists" });
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const brandId = String(req.params.id);
  const linkedProducts = await prisma.product.count({ where: { brandId } });
  if (linkedProducts > 0) {
    return res.status(409).json({ message: "Cannot delete brand with linked products" });
  }

  try {
    await prisma.brand.delete({ where: { id: brandId } });
    return res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ message: "Brand not found" });
    }
    throw error;
  }
});

export default router;
