import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { cache } from "../../config/cache.js";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";

const router = Router();

const productCreateSchema = z.object({
  brandId: z.string(),
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim().min(10),
  pricePkr: z.number().int().positive(),
  topCategory: z.enum(["Men", "Women", "Kids"]),
  subCategory: z.string().trim().min(2),
  sizes: z.array(z.string().trim().min(1)).min(1),
  imageUrl: z.string().url(),
  stock: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

const productUpdateSchema = productCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

const productTypeMap: Record<string, string[]> = {
  Top: ["T-Shirts", "Polo Shirts", "V-Neck", "Formal Shirts", "Hoodies", "Sweatshirts", "Clothing", "Outerwear", "Dresses"],
  Bottom: ["Jeans", "Trousers", "Joggers", "Cargo Pants", "Skirts"],
  Footwear: ["Slip Ons", "Sneakers", "Boots", "Sandals", "Loafers", "Footwear"],
  Accessories: ["Bags", "Belts", "Caps", "Jewelry", "Accessories"],
};

function clearProductCache() {
  cache.clear();
}

router.get("/", async (req, res) => {
  const querySchema = z.object({
    brand: z.string().optional(),
    topCategory: z.string().optional(),
    productType: z.string().optional(),
    subCategory: z.string().optional(),
    size: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    q: z.string().optional(),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query" });

  const cacheKey = `products:${JSON.stringify(parsed.data)}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ data: cached, cached: true });

  const whereClause: Prisma.ProductWhereInput = {
    isActive: true,
    brand: parsed.data.brand ? { slug: parsed.data.brand } : undefined,
    topCategory: parsed.data.topCategory,
    subCategory: parsed.data.subCategory,
    sizes: parsed.data.size ? { has: parsed.data.size } : undefined,
    pricePkr: {
      gte: parsed.data.minPrice,
      lte: parsed.data.maxPrice,
    },
    OR: parsed.data.q
      ? [
          { name: { contains: parsed.data.q, mode: "insensitive" } },
          { description: { contains: parsed.data.q, mode: "insensitive" } },
          { subCategory: { contains: parsed.data.q, mode: "insensitive" } },
          { topCategory: { contains: parsed.data.q, mode: "insensitive" } },
        ]
      : undefined,
  };

  if (parsed.data.productType && productTypeMap[parsed.data.productType]) {
    const typeFilter = { subCategory: { in: productTypeMap[parsed.data.productType] } };
    if (parsed.data.subCategory) {
      whereClause.AND = [{ subCategory: parsed.data.subCategory }, typeFilter];
      delete whereClause.subCategory;
    } else {
      whereClause.subCategory = typeFilter.subCategory;
    }
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });

  cache.set(cacheKey, products);
  return res.json({ data: products });
});

router.get("/:slug", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { brand: true },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });
  return res.json({ data: product });
});

router.get("/id/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: String(req.params.id) },
    include: { brand: true },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });
  return res.json({ data: product });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const product = await prisma.product.create({ data: parsed.data });
    clearProductCache();
    return res.status(201).json({ data: product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Product slug already exists" });
    }
    throw error;
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const product = await prisma.product.update({
      where: { id: String(req.params.id) },
      data: parsed.data,
      include: { brand: true },
    });
    clearProductCache();
    return res.json({ data: product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ message: "Product not found" });
      if (error.code === "P2002") return res.status(409).json({ message: "Product slug already exists" });
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const productId = String(req.params.id);
  const linkedOrderItems = await prisma.orderItem.count({ where: { productId } });
  if (linkedOrderItems > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
    clearProductCache();
    return res.json({ message: "Product archived because it is linked to existing orders" });
  }

  try {
    await prisma.product.delete({ where: { id: productId } });
    clearProductCache();
    return res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ message: "Product not found" });
    }
    throw error;
  }
});

export default router;
