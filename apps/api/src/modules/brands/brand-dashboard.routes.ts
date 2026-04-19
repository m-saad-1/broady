import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { cache } from "../../config/cache.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import { productBaseSchema } from "../products/product.validation.js";

const router = Router();

const productUploadsDir = path.resolve(process.cwd(), "uploads", "products");
fs.mkdirSync(productUploadsDir, { recursive: true });

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, productUploadsDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext && /^[.]([a-z0-9]{2,5})$/.test(ext) ? ext : ".jpg";
      callback(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  }),
  limits: {
    files: 12,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are allowed"));
      return;
    }
    callback(null, true);
  },
});

function clearProductCache() {
  cache.clear();
}

const brandProductCreateSchema = productBaseSchema;

const orderTransitionMap: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PACKED", "SHIPPED", "CANCELED"],
  PACKED: ["SHIPPED", "CANCELED"],
  PARTIALLY_SHIPPED: ["SHIPPED", "DELIVERED", "CANCELED"],
  SHIPPED: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

type OrderLifecycleEventName =
  | typeof notificationEventNames.orderPlaced
  | typeof notificationEventNames.orderConfirmed
  | typeof notificationEventNames.orderPacked
  | typeof notificationEventNames.orderShipped
  | typeof notificationEventNames.orderDelivered
  | typeof notificationEventNames.orderCancelled;

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

function deriveParentOrderStatus(subOrderStatuses: OrderStatus[]): OrderStatus {
  if (subOrderStatuses.length === 0) return OrderStatus.PENDING;
  if (subOrderStatuses.every((status) => status === OrderStatus.CANCELED)) return OrderStatus.CANCELED;
  if (subOrderStatuses.every((status) => status === OrderStatus.DELIVERED)) return OrderStatus.DELIVERED;
  if (subOrderStatuses.every((status) => status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED)) return OrderStatus.SHIPPED;
  if (subOrderStatuses.some((status) => status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED)) {
    return OrderStatus.PARTIALLY_SHIPPED;
  }
  if (subOrderStatuses.every((status) => status === OrderStatus.CONFIRMED)) return OrderStatus.CONFIRMED;
  if (subOrderStatuses.some((status) => status === OrderStatus.PACKED)) return OrderStatus.PACKED;
  return OrderStatus.PENDING;
}

function buildSubOrderUpdateNote(status: OrderStatus, brandName: string, parentStatus: OrderStatus, explicitNote?: string) {
  if (explicitNote) return explicitNote;

  switch (status) {
    case OrderStatus.CONFIRMED:
      return `Your ${brandName} item has been confirmed.`;
    case OrderStatus.PACKED:
      return `Your ${brandName} item has been packed.`;
    case OrderStatus.SHIPPED:
      return `Your ${brandName} item has been shipped.`;
    case OrderStatus.DELIVERED:
      return parentStatus === OrderStatus.DELIVERED
        ? "Your order has been fully delivered."
        : `Your ${brandName} item has been delivered.`;
    case OrderStatus.CANCELED:
      return `Your ${brandName} item has been canceled.`;
    default:
      return `Your ${brandName} item status is now ${status.toLowerCase()}.`;
  }
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

  const [totalProducts, activeProducts, subOrders, recentSubOrders] = await Promise.all([
    prisma.product.count({ where: { brandId: access.brandId } }),
    prisma.product.count({ where: { brandId: access.brandId, isActive: true } }),
    prisma.subOrder.findMany({
      where: { brandId: access.brandId },
      include: {
        items: true,
        order: { select: { id: true, userId: true } },
      },
    }),
    prisma.subOrder.findMany({
      where: { brandId: access.brandId },
      include: {
        order: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        brand: true,
        items: {
          include: { product: true },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const grossPkr = subOrders.reduce((acc, subOrder) => acc + subOrder.subtotalPkr, 0);
  const netPkr = Math.round(grossPkr * (1 - access.brand.commissionRate / 100));

  const byStatus = subOrders.reduce<Record<string, number>>((acc, subOrder) => {
    const key = subOrder.status;
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
        orderItems: subOrders.reduce((count, subOrder) => count + subOrder.items.length, 0),
        totalSubOrders: subOrders.length,
        byStatus,
      },
      recentSubOrders,
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

  const where: Prisma.SubOrderWhereInput = {
    brandId: access.brandId,
    status: query.data.status,
  };

  const orders = await prisma.subOrder.findMany({
    where,
    include: {
      order: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      brand: true,
      items: {
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

  const orderIdentifier = String(req.params.orderId);

  const order = await prisma.subOrder.findFirst({
    where: {
      brandId: access.brandId,
      OR: [{ id: orderIdentifier }, { orderId: orderIdentifier }],
    },
    include: {
      order: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          statusLogs: { orderBy: { createdAt: "desc" } },
        },
      },
      brand: true,
      items: {
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

  const orderIdentifier = String(req.params.orderId);

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

  const order = await prisma.subOrder.findFirst({
    where: {
      brandId: access.brandId,
      OR: [{ id: orderIdentifier }, { orderId: orderIdentifier }],
    },
    include: {
      order: {
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          subOrders: { select: { id: true, status: true, trackingId: true } },
        },
      },
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
    await tx.subOrder.update({
      where: { id: order.id },
      data: {
        status,
        trackingId,
      },
    });

    if (status === OrderStatus.CANCELED && order.status !== OrderStatus.CANCELED) {
      await restockOrderItems(
        tx,
        order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
    }

    await tx.subOrderStatusLog.create({
      data: {
        subOrderId: order.id,
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

    const refreshedSubOrders = await tx.subOrder.findMany({
      where: { orderId: order.orderId },
      select: { status: true, trackingId: true },
    });

    const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((subOrder) => subOrder.status));
    const nextTrackingId =
      refreshedSubOrders.length === 1
        ? refreshedSubOrders[0].trackingId
        : refreshedSubOrders.every((subOrder) => subOrder.trackingId && subOrder.trackingId === refreshedSubOrders[0].trackingId)
          ? refreshedSubOrders[0].trackingId
          : null;

    await tx.order.update({
      where: { id: order.orderId },
      data: {
        status: nextParentStatus,
        trackingId: nextTrackingId,
        paymentStatus:
          nextParentStatus === OrderStatus.DELIVERED && order.order.paymentMethod === "COD"
            ? PaymentStatus.COMPLETED
            : order.order.paymentStatus,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.orderId,
        status: nextParentStatus,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: parsed.data.note
            ? `Vendor group (${access.brand.name}) update: ${parsed.data.note}`
            : `Vendor group (${access.brand.name}) updated to ${status}`,
          customerNote: parsed.data.customerNote,
        }),
      },
    });

    return tx.subOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        order: {
          include: {
            user: { select: { id: true, email: true, fullName: true } },
            statusLogs: { orderBy: { createdAt: "desc" } },
          },
        },
        brand: true,
        items: { include: { product: true, brand: true } },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });
  });

  const orderEventByStatus: Record<OrderStatus, OrderLifecycleEventName> = {
    PENDING: notificationEventNames.orderPlaced,
    CONFIRMED: notificationEventNames.orderConfirmed,
    PACKED: notificationEventNames.orderPacked,
    PARTIALLY_SHIPPED: notificationEventNames.orderShipped,
    SHIPPED: notificationEventNames.orderShipped,
    DELIVERED: notificationEventNames.orderDelivered,
    CANCELED: notificationEventNames.orderCancelled,
  };

  const parentStatusAfterUpdate = updated.order.status;
  const resolvedEventName: OrderLifecycleEventName =
    status === OrderStatus.DELIVERED && parentStatusAfterUpdate !== OrderStatus.DELIVERED
      ? notificationEventNames.orderShipped
      : orderEventByStatus[status];

  const customerFacingNote = buildSubOrderUpdateNote(
    status,
    access.brand.name,
    parentStatusAfterUpdate,
    parsed.data.customerNote,
  );

  queueNotificationEvent({
    name: resolvedEventName,
    orderId: order.orderId,
    userId: order.order.userId,
    brandId: access.brandId,
    changedByRole: "BRAND",
    note: customerFacingNote,
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

router.post("/products/uploads", productImageUpload.array("images", 12), async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  if (!access.canManageProducts) {
    return res.status(403).json({ message: "You cannot manage products for this brand" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (!files.length) {
    return res.status(400).json({ message: "No image files uploaded" });
  }

  const baseUrl = `${req.protocol}://${req.get("host") || "localhost:4000"}`;
  const urls = files.map((file) => `${baseUrl}/uploads/products/${file.filename}`);
  return res.status(201).json({ data: { urls } });
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

  queueNotificationEvent({
    name: notificationEventNames.productSubmitted,
    productId: product.id,
    brandId: access.brandId,
    submittedByUserId: req.auth!.userId,
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
