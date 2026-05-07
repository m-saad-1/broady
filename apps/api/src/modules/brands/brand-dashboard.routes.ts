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
import { normalizeOrderNotificationPresentation } from "../notifications/notification.presentation.js";
import { resolveNotificationTargetPath } from "../notifications/notification.targets.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import { productBaseSchema } from "../products/product.validation.js";
import {
  DELIVERY_FAILURE_REASONS,
  buildBrandFailureMessage,
  buildCustomerFailureMessage,
  describeFailureReason,
  getDeliveryFailurePolicy,
  normalizeDeliveryFailureReasonInput,
  isValidFailureReason,
  calculateNextAttemptDate,
  detectSuspiciousFraudPatterns,
  type DeliveryFailureReasonKey,
} from "../orders/deliveryFailure.service.js";

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
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  PACKED: ["SHIPPED"],
  PARTIALLY_SHIPPED: ["SHIPPED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERY_FAILED", "DELIVERED"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNED", "ADDRESS_CORRECTION_REQUIRED"],
  ADDRESS_CORRECTION_REQUIRED: ["READY_FOR_REDELIVERY", "RETURNED"],
  READY_FOR_REDELIVERY: ["OUT_FOR_DELIVERY", "RETURNED"],
  RETURNED: ["CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

type OrderLifecycleEventName =
  | typeof notificationEventNames.orderPlaced
  | typeof notificationEventNames.orderConfirmed
  | typeof notificationEventNames.orderProcessing
  | typeof notificationEventNames.orderShipped
  | typeof notificationEventNames.orderDeliveryFailed
  | typeof notificationEventNames.orderAddressCorrectionRequired
  | typeof notificationEventNames.orderReturned
  | typeof notificationEventNames.orderDelivered
  | typeof notificationEventNames.orderCancelled;

function normalizeStatus(
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERY_FAILED"
    | "ADDRESS_CORRECTION_REQUIRED"
    | "READY_FOR_REDELIVERY"
    | "DELIVERED"
    | "RETURNED"
    | "CANCELED"
    | "CANCELLED",
): OrderStatus {
  return status === "CANCELLED" ? "CANCELED" : status;
}

const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERY_FAILED,
];

function isOpenOrderStatus(status: OrderStatus) {
  return OPEN_ORDER_STATUSES.includes(status);
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
  if (subOrderStatuses.every((status) => status === OrderStatus.RETURNED || status === OrderStatus.CANCELED)) return OrderStatus.RETURNED;
  if (subOrderStatuses.some((status) => status === OrderStatus.RETURNED)) return OrderStatus.PARTIALLY_SHIPPED;
  if (subOrderStatuses.some((status) => status === OrderStatus.ADDRESS_CORRECTION_REQUIRED)) return OrderStatus.ADDRESS_CORRECTION_REQUIRED;
  if (subOrderStatuses.some((status) => status === OrderStatus.READY_FOR_REDELIVERY)) return OrderStatus.READY_FOR_REDELIVERY;
  if (subOrderStatuses.some((status) => status === OrderStatus.DELIVERY_FAILED)) return OrderStatus.DELIVERY_FAILED;
  if (subOrderStatuses.some((status) => status === OrderStatus.OUT_FOR_DELIVERY)) return OrderStatus.OUT_FOR_DELIVERY;
  if (subOrderStatuses.some((status) => status === OrderStatus.SHIPPED || status === OrderStatus.PACKED || status === OrderStatus.PARTIALLY_SHIPPED)) return OrderStatus.SHIPPED;
  if (subOrderStatuses.every((status) => status === OrderStatus.PROCESSING)) return OrderStatus.PROCESSING;
  if (subOrderStatuses.some((status) => status === OrderStatus.PROCESSING)) return OrderStatus.PROCESSING;
  if (subOrderStatuses.every((status) => status === OrderStatus.CONFIRMED)) return OrderStatus.CONFIRMED;
  return OrderStatus.PENDING;
}


function buildSubOrderUpdateNote(status: OrderStatus, brandName: string, parentStatus: OrderStatus, explicitNote?: string) {
  if (explicitNote) return explicitNote;

  switch (status) {
    case OrderStatus.CONFIRMED:
      return `Your ${brandName} item has been confirmed.`;
    case OrderStatus.PROCESSING:
      return `Your ${brandName} item is being processed.`;
    case OrderStatus.SHIPPED:
      return `Your ${brandName} item has been shipped.`;
    case OrderStatus.OUT_FOR_DELIVERY:
      return `Your ${brandName} item is out for delivery.`;
    case OrderStatus.DELIVERY_FAILED:
      return `Delivery failed for your ${brandName} item. A retry may follow.`;
    case OrderStatus.ADDRESS_CORRECTION_REQUIRED:
      return `Your ${brandName} item requires an address correction before delivery can be reattempted.`;
    case OrderStatus.READY_FOR_REDELIVERY:
      return `Your ${brandName} item is ready for re-delivery.`;
    case OrderStatus.DELIVERED:
      return parentStatus === OrderStatus.DELIVERED
        ? "Your order has been fully delivered."
        : `Your ${brandName} item has been delivered.`;
    case OrderStatus.CANCELED:
      return `Your ${brandName} item has been canceled.`;
    case OrderStatus.RETURNED:
      return `Your ${brandName} item has been returned.`;
    default:
      return `Your ${brandName} item status is now ${status.toLowerCase()}.`;
  }
}

function resolveOrderEventName(status: OrderStatus): OrderLifecycleEventName {
  switch (status) {
    case OrderStatus.CONFIRMED:
      return notificationEventNames.orderConfirmed;
    case OrderStatus.PROCESSING:
    case OrderStatus.PACKED:
    case OrderStatus.PARTIALLY_SHIPPED:
      return notificationEventNames.orderProcessing;
    case OrderStatus.SHIPPED:
    case OrderStatus.OUT_FOR_DELIVERY:
      return notificationEventNames.orderShipped;
    case OrderStatus.DELIVERY_FAILED:
    case OrderStatus.READY_FOR_REDELIVERY:
      return notificationEventNames.orderDeliveryFailed;
    case OrderStatus.ADDRESS_CORRECTION_REQUIRED:
      return notificationEventNames.orderAddressCorrectionRequired;
    case OrderStatus.RETURNED:
      return notificationEventNames.orderReturned;
    case OrderStatus.DELIVERED:
      return notificationEventNames.orderDelivered;
    case OrderStatus.CANCELED:
      return notificationEventNames.orderCancelled;
    case OrderStatus.PENDING:
    default:
      return notificationEventNames.orderPlaced;
  }
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

  const [products, subOrders, recentOrders] = await Promise.all([
    prisma.product.findMany({
      where: { brandId: access.brandId },
      select: {
        approvalStatus: true,
        isActive: true,
        stock: true,
      },
    }),
    prisma.subOrder.findMany({
      where: { brandId: access.brandId },
      select: {
        status: true,
        subtotalPkr: true,
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

  const totalProducts = products.length;
  const activeProducts = products.filter((product) => product.isActive && product.approvalStatus === "APPROVED").length;
  const pendingProducts = products.filter((product) => product.approvalStatus === "PENDING").length;
  const outOfStockProducts = products.filter(
    (product) => product.isActive && product.approvalStatus === "APPROVED" && product.stock <= 0,
  ).length;
  const totalOrders = subOrders.length;
  const openOrders = subOrders.filter((subOrder) => isOpenOrderStatus(subOrder.status)).length;
  const deliveredOrders = subOrders.filter((subOrder) => subOrder.status === OrderStatus.DELIVERED).length;
  const cancelledOrders = subOrders.filter((subOrder) => subOrder.status === OrderStatus.CANCELED).length;
  const totalSalesPkr = subOrders.reduce(
    (acc, subOrder) => acc + (subOrder.status === OrderStatus.DELIVERED ? subOrder.subtotalPkr : 0),
    0,
  );

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
        pendingProducts,
        outOfStockProducts,
        totalOrders,
        openOrders,
        deliveredOrders,
        cancelledOrders,
        totalSalesPkr,
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
      status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "DELIVERED", "RETURNED", "CANCELED"]).optional(),
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
      status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "ADDRESS_CORRECTION_REQUIRED", "READY_FOR_REDELIVERY", "DELIVERED", "RETURNED", "CANCELED"]),
      trackingId: z.string().trim().min(4).max(120).optional(),
      note: z.string().trim().max(240).optional(),
      customerNote: z.string().trim().max(240).optional(),
      failureReason: z.string().trim().max(240).optional(),
      failureReasonMessage: z.string().trim().max(240).optional(),
      nextAttemptDate: z.coerce.date().optional(),
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

  const brandAllowedStatuses = new Set<OrderStatus>([
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERY_FAILED,
    OrderStatus.DELIVERED,
  ]);

  if (!brandAllowedStatuses.has(status)) {
    return res.status(403).json({ message: "Brand users can only move vendor groups through fulfillment states." });
  }

  if (status === OrderStatus.CONFIRMED) {
    return res.status(409).json({ message: "Orders are confirmed automatically after COD checkout or verified online payment." });
  }

  if (statusChanged && !orderTransitionMap[order.status].includes(status)) {
    return res.status(409).json({ message: `Order status cannot move from ${order.status} to ${status}.` });
  }

  if (status === OrderStatus.SHIPPED && !trackingId?.trim()) {
    return res.status(400).json({ message: "Tracking ID is required when setting status to SHIPPED." });
  }

  if (status === OrderStatus.DELIVERY_FAILED) {
    const normalizedFailureReason = normalizeDeliveryFailureReasonInput(parsed.data.failureReason);

    if (!normalizedFailureReason) {
      return res.status(400).json({
        message: "failureReason is required when delivery fails.",
        availableReasons: DELIVERY_FAILURE_REASONS,
      });
    }

    if (normalizedFailureReason === "OTHER" && !parsed.data.failureReasonMessage?.trim()) {
      return res.status(400).json({
        message: "failureReasonMessage is required when failureReason is OTHER.",
        availableReasons: DELIVERY_FAILURE_REASONS,
      });
    }

    const policy = getDeliveryFailurePolicy(normalizedFailureReason);

    if (policy.requiresAddressCorrection && !parsed.data.note?.trim()) {
      // Validate before any DB lookup so a missing internal note returns a clean 400.
      return res.status(400).json({
        message: "An internal note is required for incorrect address failures so the address can be corrected.",
      });
    }

    const recentFailures = await prisma.subOrder.findMany({
      where: {
        brandId: access.brandId,
        status: OrderStatus.DELIVERY_FAILED,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: { failureReason: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const fraudPattern = detectSuspiciousFraudPatterns(
      access.brandId,
      recentFailures.map((f) => ({
        reason: normalizeDeliveryFailureReasonInput(f.failureReason) || "OTHER",
        createdAt: f.createdAt,
      })),
    );

    if (fraudPattern.isHighRisk) {
      // Log fraud alert for admin review
      console.warn(`[FRAUD_ALERT] Brand ${access.brand.name} showing suspicious delivery failure patterns:`, fraudPattern.flags);
      // Could also queue notification to admins here
    }
  }


  if (!statusChanged && !trackingChanged && !parsed.data.note && !parsed.data.customerNote) {
    return res.json({ data: order });
  }

  // Determine if the user is a platform admin
  const actingAsPlatformAdmin = access.role === "ADMIN" || access.role === "SUPER_ADMIN";

  const updated = await prisma.$transaction(async (tx) => {
    const normalizedFailureReason = status === OrderStatus.DELIVERY_FAILED ? normalizeDeliveryFailureReasonInput(parsed.data.failureReason) : null;
    const failureReasonKey = normalizedFailureReason || "OTHER";
    const failurePolicy = status === OrderStatus.DELIVERY_FAILED ? getDeliveryFailurePolicy(failureReasonKey) : null;
    const isFinalDeliveryFailure = status === OrderStatus.DELIVERY_FAILED && order.deliveryAttempts >= (failurePolicy?.maxAttempts ?? 3);

    let effectiveStatus: OrderStatus = status;
    if (status === OrderStatus.DELIVERY_FAILED) {
      if (failureReasonKey === "INCORRECT_ADDRESS") {
        effectiveStatus = OrderStatus.ADDRESS_CORRECTION_REQUIRED;
      } else if (isFinalDeliveryFailure) {
        effectiveStatus = OrderStatus.RETURNED;
      }
    }
    const now = new Date();
    const nextAttemptDate =
      status === OrderStatus.DELIVERY_FAILED && failurePolicy?.retryable && !isFinalDeliveryFailure
        ? calculateNextAttemptDate(failureReasonKey, now)
        : null;

    await tx.subOrder.update({
      where: { id: order.id },
      data: {
        status: effectiveStatus,
        trackingId,
        deliveryAttempts: status === OrderStatus.OUT_FOR_DELIVERY ? { increment: 1 } : undefined,
        lastAttemptAt: status === OrderStatus.OUT_FOR_DELIVERY ? now : undefined,
        failureReason:
          status === OrderStatus.DELIVERY_FAILED
            ? failureReasonKey
            : status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED
              ? null
              : undefined,
        failureReasonMessage:
          status === OrderStatus.DELIVERY_FAILED
            ? parsed.data.failureReasonMessage?.trim() || null
            : status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED
              ? null
              : undefined,
        deliveryFailedAt: status === OrderStatus.DELIVERY_FAILED ? now : undefined,
        brandReminderSentAt: status === OrderStatus.DELIVERY_FAILED ? null : undefined,
        nextAttemptDate:
          status === OrderStatus.DELIVERY_FAILED
            ? nextAttemptDate
            : status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED || effectiveStatus === OrderStatus.RETURNED
              ? null
              : undefined,
        finalDeliveryFailureAt: isFinalDeliveryFailure || status === OrderStatus.RETURNED ? now : undefined,
      },
    });

    await tx.subOrderStatusLog.create({
      data: {
        subOrderId: order.id,
        status: effectiveStatus,
        updatedBy: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: isFinalDeliveryFailure
            ? `Auto-returned after final delivery failure (${describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage)}) for ${access.brand.name}`
            : parsed.data.note,
          trackingId: trackingChanged ? trackingId : undefined,
          customerNote:
            status === OrderStatus.DELIVERY_FAILED
              ? buildCustomerFailureMessage({
                  failureReason: failureReasonKey,
                  failureReasonMessage: parsed.data.failureReasonMessage,
                  paymentMethod: order.order.paymentMethod,
                  deliveryAttempt: order.deliveryAttempts,
                  maxAttempts: failurePolicy?.maxAttempts ?? 1,
                  nextAttemptDate,
                  isFinalFailure: isFinalDeliveryFailure,
                })
              : parsed.data.customerNote,
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
        updatedBy: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: parsed.data.note
            ? `Vendor group (${access.brand.name}) update: ${parsed.data.note}`
            : `Vendor group (${access.brand.name}) updated to ${effectiveStatus}`,
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


  const parentStatusAfterUpdate = updated.order.status;
  const effectiveStatus = updated.status;

  const customerFacingNote = buildSubOrderUpdateNote(
    effectiveStatus,
    access.brand.name,
    parentStatusAfterUpdate,
    parsed.data.customerNote,
  );

  if (statusChanged) {
    if (status === OrderStatus.DELIVERY_FAILED) {
      const failureReasonCode = normalizeDeliveryFailureReasonInput(parsed.data.failureReason) || "OTHER";
      const isFinal = updated.status === OrderStatus.RETURNED;
      const failurePolicy = getDeliveryFailurePolicy(failureReasonCode);

      const customerMessage = buildCustomerFailureMessage({
        failureReason: failureReasonCode,
        failureReasonMessage: parsed.data.failureReasonMessage,
        paymentMethod: order.order.paymentMethod as any,
        deliveryAttempt: order.deliveryAttempts,
        maxAttempts: failurePolicy.maxAttempts,
        nextAttemptDate: updated.nextAttemptDate,
        isFinalFailure: isFinal,
      });

      const brandMessage = buildBrandFailureMessage({
        failureReason: failureReasonCode,
        failureReasonMessage: parsed.data.failureReasonMessage,
        paymentMethod: order.order.paymentMethod as any,
        deliveryAttempt: order.deliveryAttempts,
        maxAttempts: failurePolicy.maxAttempts,
        nextAttemptDate: updated.nextAttemptDate,
        isFinalFailure: isFinal,
      });

      queueNotificationEvent({
        name: notificationEventNames.orderDeliveryFailed,
        orderId: order.orderId,
        subOrderId: order.id,
        userId: order.order.userId,
        brandId: access.brandId,
        brandName: access.brand.name,
        changedByRole: "BRAND",
        note: `${customerMessage} ${brandMessage}`.trim(),
        notifyAdmin: true,
      });

      if (updated.nextAttemptDate) {
        queueNotificationEvent({
          name: notificationEventNames.orderRetryScheduled,
          orderId: order.orderId,
          subOrderId: order.id,
          userId: order.order.userId,
          brandId: access.brandId,
          brandName: access.brand.name,
          changedByRole: "SYSTEM",
          note: `Retry scheduled for ${updated.nextAttemptDate.toISOString()}. ${brandMessage}`.trim(),
          notifyAdmin: true,
        });
      }

      if (isFinal) {
        queueNotificationEvent({
          name: notificationEventNames.orderReturned,
          orderId: order.orderId,
          subOrderId: order.id,
          userId: order.order.userId,
          brandId: access.brandId,
          brandName: access.brand.name,
          changedByRole: "SYSTEM",
          note: `Final delivery failure reached for ${describeFailureReason(failureReasonCode, parsed.data.failureReasonMessage)}. Order will be cancelled after the return window.`,
          notifyAdmin: true,
        });
      }
    } else {
      queueNotificationEvent({
        name: resolveOrderEventName(effectiveStatus),
        orderId: order.orderId,
        subOrderId: order.id,
        userId: order.order.userId,
        brandId: access.brandId,
        brandName: access.brand.name,
        changedByRole: "BRAND",
        note: customerFacingNote,
        notifyAdmin: true,
      });
    }
  }


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
      channelLogs: true,
      order: { select: { id: true, status: true, trackingId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({
    data: notifications.map((item) => ({
      ...normalizeOrderNotificationPresentation(
        {
          ...item,
          orderId: item.order?.id,
        },
        "BRAND",
      ),
      targetPath: resolveNotificationTargetPath({
        type: item.type,
        orderId: item.order?.id,
        title: item.title,
        message: item.message,
        role: req.auth?.role,
        isBrandContext: true,
      }),
    })),
  });
});

export default router;
