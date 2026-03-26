import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/summary", async (_req, res) => {
  const [brandCount, productCount, orderCount] = await Promise.all([
    prisma.brand.count(),
    prisma.product.count(),
    prisma.order.count(),
  ]);

  return res.json({
    data: {
      brandCount,
      productCount,
      orderCount,
    },
  });
});

router.get("/orders", async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return res.json({ data: orders });
});

export default router;
