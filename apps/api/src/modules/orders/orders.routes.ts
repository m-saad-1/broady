import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

const paymentMethodSchema = z.enum(["COD", "JAZZCASH", "EASYPAISA"]);

router.post("/", requireAuth, async (req, res) => {
  const schema = z.object({
    paymentMethod: paymentMethodSchema,
    deliveryAddress: z.string().min(10),
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().min(1),
        }),
      )
      .min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.items.map((item) => item.productId) } },
  });

  const productById = (productId: string) => {
    for (const product of products) {
      if (product.id === productId) return product;
    }
    return null;
  };

  const subtotal = parsed.data.items.reduce((total, item) => {
    const product = productById(item.productId);
    if (!product) return total;
    return total + product.pricePkr * item.quantity;
  }, 0);

  const order = await prisma.order.create({
    data: {
      userId: req.auth!.userId,
      paymentMethod: parsed.data.paymentMethod,
      deliveryAddress: parsed.data.deliveryAddress,
      totalPkr: subtotal,
      items: {
        create: parsed.data.items.map((item) => {
          const product = productById(item.productId);
          if (!product) {
            throw new Error("Invalid product in order items");
          }
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPricePkr: product.pricePkr,
          };
        }),
      },
    },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  // Integration point for JazzCash/Easypaisa checkout redirect or payment intent.
  const paymentRedirect =
    parsed.data.paymentMethod === "COD"
      ? null
      : `https://payments.example.com/${parsed.data.paymentMethod.toLowerCase()}/init/${order.id}`;

  return res.status(201).json({ data: order, paymentRedirect });
});

router.get("/me", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.auth!.userId },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: orders });
});

export default router;
