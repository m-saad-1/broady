import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { getCart, getCartScopeFromUser, replaceCart } from "../carts/cart.service.js";
import { normalizeOrderNotificationPresentation } from "../notifications/notification.presentation.js";
import { resolveNotificationTargetPath } from "../notifications/notification.targets.js";

const router = Router();

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128),
});

const paymentMethodSchema = z.object({
  type: z.enum(["CARD", "JAZZCASH", "EASYPAISA", "BANK"]),
  label: z.string().trim().min(2).max(100),
  last4: z.string().trim().regex(/^\d{4}$/),
  expiresMonth: z.number().int().min(1).max(12).optional(),
  expiresYear: z.number().int().min(2024).max(2100).optional(),
  isDefault: z.boolean().optional(),
});

const updatePaymentMethodSchema = paymentMethodSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

const notificationSchema = z.object({
  orderUpdates: z.boolean(),
  promoEmails: z.boolean(),
  securityAlerts: z.boolean(),
  wishlistAlerts: z.boolean(),
});

const cartSyncSchema = z.object({
  merge: z.boolean().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1),
      selectedColor: z.string().trim().min(1).max(60).optional(),
      selectedSize: z.string().trim().min(1).max(40).optional(),
    }),
  ).max(200),
});

router.get("/cart", requireAuth, async (req, res) => {
  const cart = await getCart(getCartScopeFromUser(req.auth!.userId));

  return res.json({ data: cart });
});

router.put("/cart", requireAuth, async (req, res) => {
  const parsed = cartSyncSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const scope = getCartScopeFromUser(req.auth!.userId);
  const result = await replaceCart(scope, parsed.data.items);
  if (result.error) {
    return res.status(result.error.status).json(result.error);
  }

  const cart = await getCart(scope);

  return res.json({ data: cart });
});

router.get("/wishlist", requireAuth, async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.auth!.userId },
    include: { product: { include: { brand: true } } },
  });
  return res.json({ data: items });
});

router.post("/wishlist/:productId", requireAuth, async (req, res) => {
  const productId = String(req.params.productId);
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const item = await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: req.auth!.userId, productId } },
    update: {},
    create: { userId: req.auth!.userId, productId },
  });

  return res.status(201).json({ data: item });
});

router.delete("/wishlist/:productId", requireAuth, async (req, res) => {
  const productId = String(req.params.productId);
  await prisma.wishlistItem.deleteMany({
    where: { userId: req.auth!.userId, productId },
  });

  return res.status(204).send();
});

router.post("/password", requireAuth, async (req, res) => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.password) {
    if (!parsed.data.currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }
    const isValidCurrentPassword = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!isValidCurrentPassword) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
  }

  const nextPassword = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: nextPassword,
      authProvider: user.authProvider === "LOCAL" ? "LOCAL" : user.authProvider,
    },
  });

  return res.json({ message: "Password updated" });
});

router.get("/payment-methods", requireAuth, async (req, res) => {
  const methods = await prisma.userPaymentMethod.findMany({
    where: { userId: req.auth!.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return res.json({ data: methods });
});

router.post("/payment-methods", requireAuth, async (req, res) => {
  const parsed = paymentMethodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });

  const data: Prisma.UserPaymentMethodCreateInput = {
    user: { connect: { id: req.auth!.userId } },
    ...parsed.data,
  };

  const isDefault = parsed.data.isDefault ?? false;
  if (!isDefault) {
    const hasDefault = await prisma.userPaymentMethod.findFirst({
      where: { userId: req.auth!.userId, isDefault: true },
      select: { id: true },
    });
    data.isDefault = !hasDefault;
  }

  const created = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.userPaymentMethod.updateMany({
        where: { userId: req.auth!.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.userPaymentMethod.create({ data });
  });

  return res.status(201).json({ data: created });
});

router.put("/payment-methods/:id", requireAuth, async (req, res) => {
  const parsed = updatePaymentMethodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });

  const methodId = String(req.params.id);
  const existing = await prisma.userPaymentMethod.findFirst({
    where: { id: methodId, userId: req.auth!.userId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ message: "Payment method not found" });

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault === true) {
      await tx.userPaymentMethod.updateMany({
        where: { userId: req.auth!.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.userPaymentMethod.update({
      where: { id: methodId },
      data: parsed.data,
    });
  });

  return res.json({ data: updated });
});

router.delete("/payment-methods/:id", requireAuth, async (req, res) => {
  const methodId = String(req.params.id);
  const existing = await prisma.userPaymentMethod.findFirst({
    where: { id: methodId, userId: req.auth!.userId },
  });
  if (!existing) return res.status(404).json({ message: "Payment method not found" });

  await prisma.userPaymentMethod.delete({ where: { id: methodId } });

  if (existing.isDefault) {
    const newest = await prisma.userPaymentMethod.findFirst({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
    });
    if (newest) {
      await prisma.userPaymentMethod.update({ where: { id: newest.id }, data: { isDefault: true } });
    }
  }

  return res.status(204).send();
});

router.get("/notification-preferences", requireAuth, async (req, res) => {
  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: req.auth!.userId },
    create: { userId: req.auth!.userId },
    update: {},
  });

  return res.json({ data: preferences });
});

router.put("/notification-preferences", requireAuth, async (req, res) => {
  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: req.auth!.userId },
    create: { userId: req.auth!.userId, ...parsed.data },
    update: parsed.data,
  });

  return res.json({ data: preferences });
});

router.get("/notifications", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.auth!.userId },
    include: {
      channels: true,
      order: { select: { id: true, status: true, trackingId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const roleContext =
    req.auth?.role === "ADMIN" || req.auth?.role === "SUPER_ADMIN"
      ? "ADMIN"
      : req.auth?.role === "BRAND" || req.auth?.role === "BRAND_ADMIN" || req.auth?.role === "BRAND_STAFF"
        ? "BRAND"
        : "USER";

  return res.json({
    data: notifications.map((item) => ({
      ...normalizeOrderNotificationPresentation(
        {
          ...item,
          orderId: item.order?.id,
        },
        roleContext,
      ),
      targetPath: resolveNotificationTargetPath({
        type: item.type,
        orderId: item.order?.id,
        title: item.title,
        message: item.message,
        role: req.auth?.role,
      }),
    })),
  });
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  const unread = await prisma.notification.findMany({
    where: {
      userId: req.auth!.userId,
      readAt: null,
    },
    select: { id: true },
    take: 300,
  });

  if (!unread.length) {
    return res.json({ data: { updated: 0 } });
  }

  const ids = unread.map((item) => item.id);
  const result = await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      userId: req.auth!.userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return res.json({ data: { updated: result.count } });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const existing = await prisma.notification.findFirst({
    where: { id: String(req.params.id), userId: req.auth!.userId },
    select: { id: true },
  });

  if (!existing) return res.status(404).json({ message: "Notification not found" });

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  });

  return res.json({ data: updated });
});

export default router;
