import { NotificationType, OrderStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { cache } from "../../config/cache.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { createNotificationWithChannels } from "../notifications/notification.service.js";

const router = Router();

function clearProductCache() {
  cache.clear();
}

const brandProductCreateSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim().min(10),
  pricePkr: z.number().int().positive(),
  topCategory: z.enum(["Men", "Women", "Kids"]),
  subCategory: z.string().trim().min(2),
  sizes: z.array(z.string().trim().min(1)).min(1),
  imageUrl: z.string().url(),
  stock: z.number().int().min(0),
});

const orderTransitionMap: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PACKED", "SHIPPED", "CANCELED"],
  PACKED: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

function normalizeStatus(status: "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELED" | "CANCELLED"): OrderStatus {
  return status === "CANCELLED" ? "CANCELED" : status;
}

function composeStatusNote(note?: string, trackingId?: string | null) {
  const parts: string[] = [];
  if (trackingId) parts.push(`Tracking ID: ${trackingId}`);
  if (note) parts.push(note);
  return parts.join(" | ") || undefined;
}

function buildStatusLogNote(params: { internalNote?: string; trackingId?: string | null; customerNote?: string }) {
  const base = composeStatusNote(params.internalNote, params.trackingId);
  if (!params.customerNote) {
    return base;
  }

  if (!base) {
    return `CUSTOMER_NOTE: ${params.customerNote}`;
  }

  return `${base} | CUSTOMER_NOTE: ${params.customerNote}`;
}

function formatOrderItemsSummary(
  items: Array<{ quantity: number; unitPricePkr: number; product: { name: string } }>,
) {
  return items
    .map((item) => `${item.quantity} x ${item.product.name} @ PKR ${item.unitPricePkr.toLocaleString("en-PK")}`)
    .join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toHtmlMultiline(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br/>");
}

async function restockOrderItems(tx: Prisma.TransactionClient, items: Array<{ productId: string; quantity: number }>) {
  await Promise.all(
    items.map((item) =>
      tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      }),
    ),
  );
}

const brandProductUpdateSchema = brandProductCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

async function getBrandAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, brandId: true },
  });

  if (!user) return null;

  if (user.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: user.brandId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        description: true,
        verified: true,
        commissionRate: true,
        apiEnabled: true,
        contactEmail: true,
        whatsappNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!brand) return null;

    return {
      brand,
      brandId: brand.id,
      canManageProducts: true,
      role: user.role,
    };
  }

  const membership = await prisma.brandMember.findFirst({
    where: { userId },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          description: true,
          verified: true,
          commissionRate: true,
          apiEnabled: true,
          contactEmail: true,
          whatsappNumber: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!membership) return null;

  return {
    brand: membership.brand,
    brandId: membership.brandId,
    canManageProducts: membership.canManageProducts,
    role: user.role,
  };
}

router.use(requireAuth);

router.get("/overview", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const [totalProducts, activeProducts, orderItems, recentOrders] = await Promise.all([
    prisma.product.count({ where: { brandId: access.brandId } }),
    prisma.product.count({ where: { brandId: access.brandId, isActive: true } }),
    prisma.orderItem.findMany({
      where: { brandId: access.brandId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { items: { some: { brandId: access.brandId } } },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        items: {
          where: { brandId: access.brandId },
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const grossPkr = orderItems.reduce((acc, item) => acc + item.quantity * item.unitPricePkr, 0);
  const netPkr = Math.round(grossPkr * (1 - access.brand.commissionRate / 100));

  const byStatus = orderItems.reduce<Record<string, number>>((acc, item) => {
    const key = item.order.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

    return res.json({
      data: {
        brand: access.brand,
      metrics: {
        totalProducts,
        activeProducts,
        grossPkr,
        estimatedNetPkr: netPkr,
        commissionRate: access.brand.commissionRate,
        orderItems: orderItems.length,
        byStatus,
      },
      recentOrders,
    },
  });
});

router.get("/orders", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const query = z
    .object({
      status: z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELED"]).optional(),
    })
    .safeParse(req.query);

  if (!query.success) {
    return res.status(400).json({ message: "Invalid query", issues: query.error.flatten() });
  }

  const where: Prisma.OrderWhereInput = {
    items: { some: { brandId: access.brandId } },
    status: query.data.status,
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      items: {
        where: { brandId: access.brandId },
        include: { product: true, brand: true },
      },
      statusLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: orders });
});

router.get("/orders/:orderId", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      items: { some: { brandId: access.brandId } },
    },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      items: {
        where: { brandId: access.brandId },
        include: { product: true, brand: true },
      },
      statusLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  return res.json({ data: order });
});

router.patch("/orders/:orderId/status", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const parsed = z
    .object({
      status: z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELED", "CANCELLED"]),
      trackingId: z.string().trim().min(4).max(120).optional(),
      note: z.string().trim().max(240).optional(),
      customerNote: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      items: { some: { brandId: access.brandId } },
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { product: true, brand: true } },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const status = normalizeStatus(parsed.data.status);
  const trackingId = parsed.data.trackingId ?? order.trackingId;
  const statusChanged = status !== order.status;
  const trackingChanged = trackingId !== order.trackingId;

  if (statusChanged && !orderTransitionMap[order.status].includes(status)) {
    return res.status(409).json({ message: `Order status cannot move from ${order.status} to ${status}.` });
  }

  if (!statusChanged && !trackingChanged && !parsed.data.note && !parsed.data.customerNote) {
    return res.json({ data: order });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        trackingId,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: { where: { brandId: access.brandId }, include: { product: true, brand: true } },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (status === OrderStatus.CANCELED && order.status !== OrderStatus.CANCELED) {
      await restockOrderItems(
        tx,
        nextOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
    }

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: parsed.data.note,
          trackingId: trackingChanged ? trackingId : undefined,
          customerNote: parsed.data.customerNote,
        }),
      },
    });

    const notificationPreference = await tx.notificationPreference.findUnique({
      where: { userId: order.userId },
      select: { orderUpdates: true },
    });

    const statusMessage = `Broady updated order ${order.id} to ${status}${nextOrder.trackingId ? ` (Tracking: ${nextOrder.trackingId})` : ""}.`;
    const statusItemsSummary = formatOrderItemsSummary(nextOrder.items);

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.ORDER_STATUS_UPDATED,
      title: "Broady Order Update",
      message: statusMessage,
      userId: order.userId,
      orderId: order.id,
      emailRecipient: notificationPreference?.orderUpdates === false ? undefined : order.user.email,
      whatsappRecipient: access.brand.whatsappNumber,
      emailSubject: `Broady Order ${order.id}: ${status}`,
      emailText: [
        `Hi ${nextOrder.user.fullName || "Customer"},`,
        "",
        statusMessage,
        "",
        "Items from this brand:",
        statusItemsSummary,
      ].join("\n"),
      emailHtml: `<p>Hi ${escapeHtml(nextOrder.user.fullName || "Customer")},</p><p>${escapeHtml(statusMessage)}</p><p><strong>Items from this brand</strong><br/>${toHtmlMultiline(statusItemsSummary)}</p>`,
      whatsappPayload: {
        orderId: order.id,
        status,
        trackingId: nextOrder.trackingId,
        brandId: access.brandId,
      },
    });

    return nextOrder;
  });

  return res.json({ data: updated });
});

router.get("/products", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const products = await prisma.product.findMany({
    where: { brandId: access.brandId },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: products });
});

router.post("/products", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  if (!access.canManageProducts) {
    return res.status(403).json({ message: "You cannot manage products for this brand" });
  }

  const parsed = brandProductCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      brandId: access.brandId,
      approvalStatus: "PENDING",
      isActive: false,
    },
  });

  await createNotificationWithChannels({
    prismaClient: prisma,
    type: NotificationType.BRAND_ORDER_ASSIGNED,
    title: "New Product Submitted to Broady",
    message: `Brand submitted product ${product.name} for Broady approval.`,
    brandId: access.brandId,
    emailRecipient: access.brand.contactEmail,
    whatsappRecipient: access.brand.whatsappNumber,
  });

  clearProductCache();
  return res.status(201).json({ data: product });
});

router.put("/products/:id", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  if (!access.canManageProducts) {
    return res.status(403).json({ message: "You cannot manage products for this brand" });
  }

  const parsed = brandProductUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const product = await prisma.product.findFirst({
    where: { id: String(req.params.id), brandId: access.brandId },
    select: { id: true, approvalStatus: true },
  });

  if (!product) return res.status(404).json({ message: "Product not found" });

  if (product.approvalStatus === "APPROVED") {
    // Brand edits to approved products must go back through Broady approval.
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      ...parsed.data,
      approvalStatus: "PENDING" as const,
      isActive: false,
    },
  });

  return res.json({ data: updated });
});

router.get("/notifications", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: req.auth!.userId }, { brandId: access.brandId }],
    },
    include: {
      channels: true,
      order: { select: { id: true, status: true, trackingId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ data: notifications });
});

export default router;
