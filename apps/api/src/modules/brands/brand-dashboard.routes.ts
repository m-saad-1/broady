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
import { createProduct, productStructureInclude, updateProduct } from "../products/product.service.js";
import {
  DELIVERY_FAILURE_REASONS,
  buildBrandFailureMessage,
  buildCustomerFailureMessage,
  describeFailureReason,
  getDeliveryFailurePolicy,
  normalizeDeliveryFailureReasonInput,
  calculateNextAttemptDate,
  detectSuspiciousFraudPatterns,
} from "../orders/deliveryFailure.service.js";
import {
  BRAND_FULFILLMENT_STATUSES,
  SUBORDER_TRANSITIONS,
  calculateRefundItems,
  createRefundRecord,
  deriveParentOrderStatus as deriveLifecycleParentOrderStatus,
  getRefundMethodForPayment,
  recordCodRefusalIfNeeded,
  shouldCreateRefundForPayment,
  writeStatusHistory,
} from "../orders/order-lifecycle.service.js";
import {
  BRAND_RECEIPT_ACTIONABLE_STATUSES,
  BRAND_RECOMMENDATION_ACTIONABLE_STATUSES,
  inferReturnRequestType,
  normalizeReturnRequestForApi,
} from "../orders/return-workflow.js";
import { runShippingAutomationSweep } from "../orders/shippingAutomation.service.js";

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

const orderTransitionMap: Record<OrderStatus, OrderStatus[]> = SUBORDER_TRANSITIONS;

type OrderLifecycleEventName =
  | typeof notificationEventNames.orderPlaced
  | typeof notificationEventNames.orderConfirmed
  | typeof notificationEventNames.orderProcessing
  | typeof notificationEventNames.orderShipped
  | typeof notificationEventNames.orderDeliveryFailed
  | typeof notificationEventNames.orderAddressCorrectionRequired
  | typeof notificationEventNames.orderShipmentReturned
  | typeof notificationEventNames.orderReturned
  | typeof notificationEventNames.orderDelivered
  | typeof notificationEventNames.orderCancelled;

function normalizeStatus(
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "PACKED"
    | "READY_FOR_PICKUP"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERY_FAILED"
    | "ADDRESS_CORRECTION_REQUIRED"
    | "READY_FOR_REDELIVERY"
    | "SHIPMENT_RETURNED"
    | "DELIVERED"
    | "RETURNED"
    | "CANCELED"
    | "CANCELLED",
): OrderStatus {
  if (status === "CANCELLED") return "CANCELED";
  return status;
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

function getAutoEstimatedDelivery(status: OrderStatus, now: Date): Date | null {
  if (status === OrderStatus.SHIPPED) {
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  }
  if (status === OrderStatus.OUT_FOR_DELIVERY) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  return null;
}

function deriveParentOrderStatus(subOrderStatuses: OrderStatus[]): OrderStatus {
  return deriveLifecycleParentOrderStatus(subOrderStatuses);
}


function buildSubOrderUpdateNote(status: OrderStatus, brandName: string, parentStatus: OrderStatus, explicitNote?: string) {
  if (explicitNote) return explicitNote;

  switch (status) {
    case OrderStatus.CONFIRMED:
      return `Your ${brandName} item has been confirmed.`;
    case OrderStatus.PROCESSING:
      return `Your ${brandName} item is being processed.`;
    case OrderStatus.PACKED:
      return `Your ${brandName} item has been packed.`;
    case OrderStatus.READY_FOR_PICKUP:
      return `Your ${brandName} item is ready for courier pickup.`;
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
    case OrderStatus.SHIPMENT_RETURNED:
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
    case OrderStatus.READY_FOR_PICKUP:
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
    case OrderStatus.SHIPMENT_RETURNED:
      return notificationEventNames.orderShipmentReturned;
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
      status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "ADDRESS_CORRECTION_REQUIRED", "READY_FOR_REDELIVERY", "DELIVERED", "SHIPMENT_RETURNED", "RETURNED", "CANCELED"]).optional(),
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
      returnRequests: {
        select: {
          id: true,
          status: true,
          requestType: true,
          preferredResolution: true,
          reasonCode: true,
          reasonText: true,
          customerNote: true,
          orderItemIds: true,
          replacementStatus: true,
          replacementUnavailable: true,
          convertedToRefund: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  void runShippingAutomationSweep().catch(() => undefined);

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

router.get("/cancellation-requests", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const requests = await prisma.cancellationRequest.findMany({
    where: { brandId: access.brandId },
    include: {
      order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
      subOrder: {
        include: {
          brand: true,
          items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
        },
      },
      history: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ data: requests });
});

router.patch("/cancellation-requests/:requestId/respond", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const payload = z
    .object({
      responseCode: z.enum(["STILL_CANCELLABLE", "ORDER_ALREADY_PACKED", "COURIER_PICKUP_SCHEDULED", "TRACKING_ALREADY_GENERATED", "ALREADY_HANDED_TO_COURIER", "OTHER_OPERATIONAL_REASON"]),
      note: z.string().trim().max(500).optional(),
      trackingEvidence: z.string().trim().max(160).optional(),
      evidenceUrl: z.string().trim().url().max(500).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (payload.data.responseCode === "OTHER_OPERATIONAL_REASON" && !payload.data.note?.trim()) {
    return res.status(400).json({ message: "note is required for other operational reasons." });
  }

  if ((payload.data.responseCode === "TRACKING_ALREADY_GENERATED" || payload.data.responseCode === "ALREADY_HANDED_TO_COURIER") && !payload.data.trackingEvidence?.trim()) {
    return res.status(400).json({ message: "trackingEvidence is required for tracking or courier handover evidence." });
  }

  const request = await prisma.cancellationRequest.findFirst({
    where: { id: String(req.params.requestId), brandId: access.brandId },
  });

  if (!request) return res.status(404).json({ message: "Cancellation request not found" });
  if (request.status !== "REQUESTED" && request.status !== "EXPIRED") {
    return res.status(409).json({ message: "Only requested or expired cancellation requests can be updated." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.cancellationRequest.update({
      where: { id: request.id },
      data: {
        brandResponseCode: payload.data.responseCode,
        brandResponseNote: payload.data.note?.trim() || null,
        trackingEvidence: payload.data.trackingEvidence?.trim() || null,
        evidenceUrl: payload.data.evidenceUrl?.trim() || null,
        respondedAt: new Date(),
      },
    });

    await tx.cancellationHistory.create({
      data: {
        cancellationRequestId: request.id,
        action: "BRAND_RESPONDED",
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note: payload.data.note?.trim() || payload.data.responseCode,
      },
    });

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.cancellationRequestCreated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.requestedById || undefined,
    brandId: request.brandId,
    brandName: access.brand.name,
    changedByRole: "BRAND",
    note: `Brand response: ${payload.data.responseCode}${payload.data.note ? `: ${payload.data.note}` : ""}`,
    notifyAdmin: true,
  });

  return res.json({ data: updated });
});

router.get("/return-requests", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const requests = await prisma.returnRequest.findMany({
    where: { subOrder: { brandId: access.brandId } },
    include: {
      order: {
        select: {
          id: true,
          userId: true,
          paymentMethod: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      subOrder: {
        include: {
          brand: true,
          items: {
            select: {
              id: true,
              quantity: true,
              selectedColor: true,
              selectedSize: true,
              unitPricePkr: true,
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" } },
      refundRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amountPkr: true,
          adjustedAmountPkr: true,
          method: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ data: requests.map((request) => normalizeReturnRequestForApi(request)) });
});

router.get("/return-requests/:returnRequestId", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const request = await prisma.returnRequest.findFirst({
    where: {
      id: String(req.params.returnRequestId),
      subOrder: { brandId: access.brandId },
    },
    include: {
      order: {
        select: {
          id: true,
          userId: true,
          paymentMethod: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      subOrder: {
        include: {
          brand: true,
          items: {
            select: {
              id: true,
              quantity: true,
              selectedColor: true,
              selectedSize: true,
              unitPricePkr: true,
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" } },
      refundRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amountPkr: true,
          adjustedAmountPkr: true,
          method: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!request) return res.status(404).json({ message: "Return request not found" });

  return res.json({ data: normalizeReturnRequestForApi(request) });
});

router.get("/refund-requests", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const requests = await prisma.refundRequest.findMany({
    where: { subOrder: { brandId: access.brandId } },
    include: {
      order: { select: { id: true, userId: true, paymentMethod: true, paymentStatus: true, totalPkr: true, createdAt: true } },
      subOrder: {
        include: {
          brand: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
        },
      },
      returnRequest: {
        include: {
          statusLogs: { orderBy: { createdAt: "asc" } },
          history: { orderBy: { createdAt: "asc" } },
        },
      },
      items: {
        include: {
          orderItem: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      statusLogs: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ data: requests });
});

router.patch("/return-requests/:returnRequestId/recommendation", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const directAvailabilityRejectReasons = new Set([
    "PRODUCT_NOT_AVAILABLE",
    "COLOR_UNAVAILABLE",
    "SIZE_UNAVAILABLE",
    "PRODUCT_DISCONTINUED",
    "ITEM_DAMAGED",
    "OTHER",
  ]);

  const payload = z
    .object({
      recommendation: z.enum(["APPROVE", "REJECT", "NEED_MORE_EVIDENCE"]),
      recommendationNote: z.string().trim().max(500).optional(),
      note: z.string().trim().max(500).optional(),
      conditionNote: z.string().trim().max(500).optional(),
      damageNote: z.string().trim().max(500).optional(),
      brandEvidenceUrls: z.array(z.string().trim().url().max(500)).max(5).optional(),
      rejectReason: z.string().trim().max(120).optional(),
      canFulfillReplacement: z.boolean().optional(),
      replacementAvailable: z.boolean().optional(),
      replacementUnavailableReason: z.string().trim().max(240).optional(),
      replacementVariantId: z.string().trim().max(120).optional(),
      replacementSku: z.string().trim().max(120).optional(),
      replacementColor: z.string().trim().max(80).optional(),
      replacementSize: z.string().trim().max(80).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const recommendationNote = payload.data.recommendationNote?.trim() || payload.data.note?.trim() || undefined;

  if ((payload.data.recommendation === "REJECT" || payload.data.recommendation === "NEED_MORE_EVIDENCE") && !recommendationNote) {
    return res.status(400).json({ message: "A recommendation note is required for reject or need-more-evidence actions." });
  }
  if (payload.data.recommendation === "REJECT" && !payload.data.rejectReason?.trim()) {
    return res.status(400).json({ message: "rejectReason is required when recommendation is REJECT." });
  }

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: { order: true, subOrder: true },
  });
  if (!request) return res.status(404).json({ message: "Return request not found" });
  const requestRecord = request as any;
  if (!BRAND_RECOMMENDATION_ACTIONABLE_STATUSES.has(request.status)) {
    return res.status(409).json({ message: "Brand recommendation is available only while the return is under review." });
  }

  const requestType = inferReturnRequestType(request);
  const directAvailabilityReject =
    requestType === "EXCHANGE" &&
    payload.data.recommendation === "REJECT" &&
    directAvailabilityRejectReasons.has(payload.data.rejectReason?.trim() || "");

  const nextStatus =
    payload.data.recommendation === "NEED_MORE_EVIDENCE"
      ? "NEED_MORE_EVIDENCE"
      : payload.data.recommendation === "REJECT"
        ? "BRAND_REJECTED"
        : "BRAND_APPROVED";
  const updateNote =
    recommendationNote || payload.data.recommendation;

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        requestType,
        brandRecommendation: payload.data.recommendation,
        brandRecommendationNote: recommendationNote || null,
        brandRejectReason: payload.data.rejectReason?.trim() || null,
        brandConditionNote: request.brandConditionNote,
        brandDamageNote: request.brandDamageNote,
        brandRecommendedAt: new Date(),
        canFulfillReplacement: payload.data.recommendation === "APPROVE" ? true : request.canFulfillReplacement,
        replacementUnavailable: directAvailabilityReject,
        replacementUnavailableReason:
          directAvailabilityReject
            ? recommendationNote || payload.data.replacementUnavailableReason?.trim() || payload.data.rejectReason?.trim() || "Replacement is unavailable."
            : null,
        requestedReplacementVariantId: requestRecord.requestedReplacementVariantId,
        replacementSku: requestRecord.replacementSku,
        requestedReplacementColor: requestRecord.requestedReplacementColor,
        requestedReplacementSize: requestRecord.requestedReplacementSize,
        damageEvidenceUrls: payload.data.brandEvidenceUrls?.length ? payload.data.brandEvidenceUrls : request.damageEvidenceUrls,
      },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
        subOrder: {
          include: {
            brand: true,
            items: {
              select: {
                id: true,
                quantity: true,
                selectedColor: true,
                selectedSize: true,
                unitPricePkr: true,
                product: { select: { id: true, name: true, imageUrl: true } },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amountPkr: true,
            adjustedAmountPkr: true,
            method: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: nextStatus,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: updateNote,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: nextStatus,
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        brandRecommendation: payload.data.recommendation,
        note: updateNote,
      },
    });

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note:
      payload.data.recommendation === "NEED_MORE_EVIDENCE"
        ? `Brand requested more evidence${recommendationNote ? `: ${recommendationNote}` : ""}`
        : payload.data.recommendation === "REJECT"
          ? directAvailabilityReject
            ? `Brand rejected the exchange because the requested replacement is unavailable${recommendationNote ? `: ${recommendationNote}` : ""}`
            : `Brand rejected the request${recommendationNote ? `: ${recommendationNote}` : ""}`
          : `Brand approved the request${recommendationNote ? `: ${recommendationNote}` : ""}`,
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/return-logistics", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const payload = z
    .object({
      status: z.enum(["RETURN_ARRANGED", "RETURN_IN_TRANSIT"]),
      returnCourier: z.string().trim().max(80).optional(),
      returnTrackingNumber: z.string().trim().max(160).optional(),
      returnInstructions: z.string().trim().max(500).optional(),
      expectedReturnDate: z.coerce.date().optional(),
      returnNote: z.string().trim().max(500).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (payload.data.status === "RETURN_ARRANGED") {
    if (!payload.data.returnCourier?.trim() || !payload.data.returnTrackingNumber?.trim() || !payload.data.returnInstructions?.trim() || !payload.data.expectedReturnDate) {
      return res.status(400).json({ message: "Return arrangement requires courier, tracking number, return instructions, and expected return date." });
    }
  }

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: {
      order: true,
      subOrder: {
        include: {
          brand: true,
          items: {
            select: {
              id: true,
              quantity: true,
              selectedColor: true,
              selectedSize: true,
              unitPricePkr: true,
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!request) return res.status(404).json({ message: "Return request not found" });

  const currentStatus = request.status as string;
  if (
    payload.data.status === "RETURN_ARRANGED" &&
    !["BRAND_APPROVED", "ADMIN_APPROVED", "RETURN_ARRANGED"].includes(currentStatus)
  ) {
    return res.status(409).json({ message: "Return arrangement is only available after the request has been approved." });
  }
  if (
    payload.data.status === "RETURN_IN_TRANSIT" &&
    !["RETURN_ARRANGED", "RETURN_IN_TRANSIT"].includes(currentStatus)
  ) {
    return res.status(409).json({ message: "Return transit updates are only available after return logistics have been arranged." });
  }

  const requestType = inferReturnRequestType(request);
  const note =
    payload.data.returnNote?.trim() ||
    (payload.data.status === "RETURN_ARRANGED"
      ? `Return arranged via ${payload.data.returnCourier}.`
      : `Return is in transit${payload.data.returnTrackingNumber ? ` (${payload.data.returnTrackingNumber})` : ""}.`);

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: payload.data.status,
        requestType,
        pickupCourier: payload.data.returnCourier?.trim() || request.pickupCourier,
        pickupDate: payload.data.expectedReturnDate || request.pickupDate,
        pickupAddress: payload.data.returnInstructions?.trim() || request.pickupAddress,
        pickupTracking: payload.data.returnTrackingNumber?.trim() || request.pickupTracking,
        returnTrackingNumber: payload.data.returnTrackingNumber?.trim() || request.returnTrackingNumber,
        reviewNote: note,
      },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
        subOrder: {
          include: {
            brand: true,
            items: {
              select: {
                id: true,
                quantity: true,
                selectedColor: true,
                selectedSize: true,
                unitPricePkr: true,
                product: { select: { id: true, name: true, imageUrl: true } },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amountPkr: true,
            adjustedAmountPkr: true,
            method: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: payload.data.status,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: payload.data.status,
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note,
      },
    });

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note,
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/receipt", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const payload = z
    .object({
      outcome: z.enum(["APPROVED", "DISPUTED"]),
      conditionNote: z.string().trim().min(3).max(500),
      damageNote: z.string().trim().max(500).optional(),
      disputeReason: z.string().trim().max(500).optional(),
      evidenceUrls: z.array(z.string().trim().url().max(500)).max(5).optional(),
      receivedAt: z.coerce.date().optional(),
      damageEvidenceUrls: z.array(z.string().trim().url().max(500)).max(5).optional(),
      damageClaimNote: z.string().trim().max(500).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const evidenceUrls =
    payload.data.evidenceUrls?.length
      ? payload.data.evidenceUrls
      : payload.data.damageEvidenceUrls?.length
        ? payload.data.damageEvidenceUrls
        : undefined;
  const disputeReason = payload.data.disputeReason?.trim() || payload.data.damageClaimNote?.trim() || undefined;

  if (payload.data.outcome === "DISPUTED" && !disputeReason) {
    return res.status(400).json({ message: "disputeReason is required when the returned item condition is disputed." });
  }

  if (payload.data.outcome === "DISPUTED" && !evidenceUrls?.length) {
    return res.status(400).json({ message: "Evidence URLs are required when the returned item condition is disputed." });
  }

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: {
      order: true,
      subOrder: {
        include: {
          brand: true,
          items: {
            select: {
              id: true,
              quantity: true,
              selectedColor: true,
              selectedSize: true,
              unitPricePkr: true,
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!request) return res.status(404).json({ message: "Return request not found" });
  if (!BRAND_RECEIPT_ACTIONABLE_STATUSES.has(request.status)) {
    return res.status(409).json({ message: "Return receipt can be confirmed only after pickup or while the return is in transit." });
  }

  const requestType = inferReturnRequestType(request);
  const receiptTimestamp = payload.data.receivedAt || new Date();
  const receiptNote = payload.data.conditionNote.trim();
  const disputed = payload.data.outcome === "DISPUTED";
  const nextStatus = disputed
    ? "RETURN_CONDITION_DISPUTED"
    : requestType === "EXCHANGE"
      ? "REPLACEMENT_PROCESSING"
      : "REFUND_INITIATED";
  const finalNote = disputed
    ? `${disputeReason}: ${receiptNote}`
    : requestType === "EXCHANGE"
      ? `Returned item received and accepted. ${receiptNote}`
      : `Returned item received and accepted. ${receiptNote}`;

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: "RETURN_RECEIVED",
        requestType,
        reviewNote: receiptNote,
        returnReceivedAt: receiptTimestamp,
        returnReceivedByBrandId: access.brandId,
        returnReceiptConditionNote: receiptNote,
        returnReceiptEvidenceUrls: evidenceUrls?.length ? evidenceUrls : request.returnReceiptEvidenceUrls,
        noReceiptReportedAt: request.noReceiptReportedAt,
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: "RETURN_RECEIVED",
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: receiptNote,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: "RETURN_RECEIVED",
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note: receiptNote,
      },
    });

    if (disputed) {
      await dbTx.returnRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          brandConditionNote: receiptNote,
          brandDamageNote: payload.data.damageNote?.trim() || request.brandDamageNote,
          damageClaimNote: disputeReason,
          damageClaimSubmittedAt: new Date(),
          damageEvidenceUrls: evidenceUrls || request.damageEvidenceUrls,
          reviewNote: finalNote,
        },
      });
    } else if (requestType === "EXCHANGE") {
      await dbTx.returnRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          brandConditionNote: receiptNote,
          brandDamageNote: payload.data.damageNote?.trim() || request.brandDamageNote,
          reviewNote: finalNote,
          replacementStatus: "REPLACEMENT_PROCESSING",
        },
      });
    } else {
      const existingRefund = await dbTx.refundRequest.findFirst({
        where: {
          returnRequestId: request.id,
          status: { in: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED"] },
        },
        select: { id: true },
      });

      if (!existingRefund) {
        const refund = calculateRefundItems(request.subOrder.items, request.orderItemIds || undefined);
        if (refund.amountPkr > 0) {
          await createRefundRecord(tx, {
            orderId: request.orderId,
            subOrderId: request.subOrderId,
            returnRequestId: request.id,
            requestedByRole: "SYSTEM",
            requestedById: req.auth!.userId,
            reasonCode: "RETURNED_PRODUCT",
            reasonText: request.reasonText || request.reasonCode,
            method: getRefundMethodForPayment(request.order.paymentMethod),
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: "Refund auto-initiated after receipt confirmation and condition approval.",
          });
        }
      }

      await dbTx.returnRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          brandConditionNote: receiptNote,
          brandDamageNote: payload.data.damageNote?.trim() || request.brandDamageNote,
          reviewNote: finalNote,
          refundStatusSnapshot: "INITIATED",
        },
      });
    }

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: nextStatus,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: finalNote,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: "RETURN_RECEIVED",
        newStatus: nextStatus,
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note: finalNote,
      },
    });

    return dbTx.returnRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
        subOrder: {
          include: {
            brand: true,
            items: {
              select: {
                id: true,
                quantity: true,
                selectedColor: true,
                selectedSize: true,
                unitPricePkr: true,
                product: { select: { id: true, name: true, imageUrl: true } },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amountPkr: true,
            adjustedAmountPkr: true,
            method: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note: disputed
      ? "Returned item received, but the brand disputed the item condition. Broady review is required."
      : requestType === "EXCHANGE"
        ? "Returned item received and accepted. Replacement processing has started."
        : "Returned item received and accepted. Refund has been initiated.",
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/condition", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const payload = z
    .object({
      outcome: z.enum(["APPROVED", "DISPUTED"]),
      conditionNote: z.string().trim().max(500).optional(),
      damageNote: z.string().trim().max(500).optional(),
      disputeReason: z.string().trim().max(240).optional(),
      evidenceUrls: z.array(z.string().trim().url().max(500)).max(5).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (!payload.data.conditionNote?.trim()) {
    return res.status(400).json({ message: "conditionNote is required when inspecting a returned item." });
  }
  if (payload.data.outcome === "DISPUTED" && !payload.data.disputeReason?.trim()) {
    return res.status(400).json({ message: "disputeReason is required when the return condition is disputed." });
  }

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: {
      order: true,
      subOrder: {
        include: {
          brand: true,
          items: {
            select: {
              id: true,
              quantity: true,
              selectedColor: true,
              selectedSize: true,
              unitPricePkr: true,
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!request) return res.status(404).json({ message: "Return request not found" });
  if ((request.status as string) !== "RETURN_RECEIVED") {
    return res.status(409).json({ message: "Return condition can be inspected only after receipt confirmation." });
  }

  const requestType = inferReturnRequestType(request);
  const nextStatus =
    payload.data.outcome === "APPROVED"
      ? requestType === "EXCHANGE"
        ? "REPLACEMENT_PROCESSING"
        : "RETURN_CONDITION_APPROVED"
      : "RETURN_CONDITION_DISPUTED";
  const conditionNote = payload.data.conditionNote.trim();
  const note =
    payload.data.outcome === "APPROVED"
      ? conditionNote
      : `${payload.data.disputeReason?.trim()}: ${conditionNote}`;

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        requestType,
        brandConditionNote: conditionNote,
        brandDamageNote: payload.data.damageNote?.trim() || request.brandDamageNote,
        damageClaimNote: payload.data.outcome === "DISPUTED" ? payload.data.disputeReason?.trim() || request.damageClaimNote : request.damageClaimNote,
        damageClaimSubmittedAt: payload.data.outcome === "DISPUTED" ? new Date() : request.damageClaimSubmittedAt,
        damageEvidenceUrls: payload.data.evidenceUrls?.length ? payload.data.evidenceUrls : request.damageEvidenceUrls,
        reviewNote: note,
        replacementStatus:
          payload.data.outcome === "APPROVED" && requestType === "EXCHANGE"
            ? "REPLACEMENT_PROCESSING"
            : request.replacementStatus,
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: nextStatus,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: nextStatus,
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note,
      },
    });

    if (payload.data.outcome === "APPROVED" && requestType === "RETURN") {
      const existingRefund = await dbTx.refundRequest.findFirst({
        where: {
          returnRequestId: request.id,
          status: { in: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED"] },
        },
        select: { id: true },
      });

      if (!existingRefund) {
        const refundableSubOrderItems = (request.subOrder as typeof request.subOrder & {
          items: Array<{ id: string; quantity: number; unitPricePkr: number }>;
        }).items;
        const refund = calculateRefundItems(refundableSubOrderItems, request.orderItemIds || undefined);
        if (refund.amountPkr > 0) {
          await createRefundRecord(tx, {
            orderId: request.orderId,
            subOrderId: request.subOrderId,
            returnRequestId: request.id,
            requestedByRole: "SYSTEM",
            requestedById: req.auth!.userId,
            reasonCode: "RETURNED_PRODUCT",
            reasonText: request.reasonText || request.reasonCode,
            method: getRefundMethodForPayment(request.order.paymentMethod),
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: "Refund auto-initiated after the brand approved the returned item condition.",
          });
        }
      }

      await dbTx.returnRequest.update({
        where: { id: request.id },
        data: {
          status: "REFUND_INITIATED",
          refundStatusSnapshot: "INITIATED",
        },
      });

      await dbTx.returnStatusLog.create({
        data: {
          returnRequestId: request.id,
          status: "REFUND_INITIATED",
          updatedBy: "SYSTEM",
          updatedById: req.auth!.userId,
          note: "Refund auto-initiated and sent for admin review.",
        },
      });

      await dbTx.returnHistory.create({
        data: {
          returnRequestId: request.id,
          oldStatus: "RETURN_CONDITION_APPROVED",
          newStatus: "REFUND_INITIATED",
          performedByRole: "SYSTEM",
          performedById: req.auth!.userId,
          note: "Refund auto-initiated and sent for admin review.",
        },
      });
    }

    return dbTx.returnRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
        subOrder: {
          include: {
            brand: true,
            items: {
              select: {
                id: true,
                quantity: true,
                selectedColor: true,
                selectedSize: true,
                unitPricePkr: true,
                product: { select: { id: true, name: true, imageUrl: true } },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amountPkr: true,
            adjustedAmountPkr: true,
            method: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note:
      payload.data.outcome === "APPROVED"
        ? requestType === "EXCHANGE"
          ? "Brand approved the returned item condition. Replacement processing has started."
          : "Brand approved the returned item condition. Refund was initiated and sent for admin review."
        : "Brand disputed the returned item condition. Broady admin review is required.",
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/replacement-processing", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: { order: true, subOrder: { include: { brand: true } } },
  });
  if (!request) return res.status(404).json({ message: "Return request not found" });
  if (inferReturnRequestType(request) !== "EXCHANGE") {
    return res.status(409).json({ message: "Replacement processing is only available for exchange requests." });
  }
  if (!["RETURN_CONDITION_APPROVED", "ADMIN_APPROVED", "RETURN_RECEIVED", "RECEIVED"].includes(request.status as string)) {
    return res.status(409).json({ message: "Replacement processing can start only after the returned item has been approved." });
  }
  if ((request as any).convertedToRefund || (request as any).replacementUnavailable) {
    return res.status(409).json({ message: "Replacement processing is unavailable because this exchange is on the refund path." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: "REPLACEMENT_PROCESSING",
        replacementStatus: "REPLACEMENT_PROCESSING",
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: "REPLACEMENT_PROCESSING",
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: "Replacement marked as processing.",
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: "REPLACEMENT_PROCESSING",
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note: "Replacement marked as processing.",
      },
    });

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note: "Original item received. Replacement is being prepared.",
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/replacement-shipment", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const nextReplacementStatuses: Record<string, string[]> = {
    RETURN_RECEIVED: ["REPLACEMENT_PROCESSING"],
    RETURN_CONDITION_APPROVED: ["REPLACEMENT_PROCESSING"],
    ADMIN_APPROVED: ["REPLACEMENT_PROCESSING"],
    REPLACEMENT_PROCESSING: ["REPLACEMENT_PACKED"],
    REPLACEMENT_PACKED: ["REPLACEMENT_READY_FOR_PICKUP"],
    REPLACEMENT_READY_FOR_PICKUP: ["REPLACEMENT_SHIPPED"],
    REPLACEMENT_SHIPPED: ["REPLACEMENT_OUT_FOR_DELIVERY"],
    REPLACEMENT_OUT_FOR_DELIVERY: ["REPLACEMENT_DELIVERY_FAILED", "REPLACEMENT_DELIVERED"],
    REPLACEMENT_DELIVERY_FAILED: ["REPLACEMENT_OUT_FOR_DELIVERY"],
    REPLACEMENT_ADDRESS_CORRECTION_REQUIRED: ["REPLACEMENT_READY_FOR_REDELIVERY"],
    REPLACEMENT_READY_FOR_REDELIVERY: ["REPLACEMENT_OUT_FOR_DELIVERY", "REPLACEMENT_SHIPMENT_RETURNED"],
  };

  const payload = z
    .object({
      status: z.enum([
        "REPLACEMENT_PROCESSING",
        "REPLACEMENT_PACKED",
        "REPLACEMENT_READY_FOR_PICKUP",
        "REPLACEMENT_SHIPPED",
        "REPLACEMENT_OUT_FOR_DELIVERY",
        "REPLACEMENT_DELIVERY_FAILED",
        "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED",
        "REPLACEMENT_READY_FOR_REDELIVERY",
        "REPLACEMENT_SHIPMENT_RETURNED",
        "REPLACEMENT_DELIVERED",
      ]),
      replacementTrackingNo: z.string().trim().min(3).max(120).optional(),
      replacementCourier: z.string().trim().min(2).max(60).optional(),
      replacementDispatchDate: z.coerce.date().optional(),
      replacementEstimatedDelivery: z.coerce.date().optional(),
      replacementShipmentNote: z.string().trim().max(500).optional(),
      replacementFailureReason: z.string().trim().max(80).optional(),
      replacementFailureReasonMessage: z.string().trim().max(300).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (
    payload.data.status === "REPLACEMENT_SHIPPED" &&
    (
      !payload.data.replacementTrackingNo?.trim() ||
      !payload.data.replacementCourier?.trim() ||
      !payload.data.replacementDispatchDate ||
      !payload.data.replacementEstimatedDelivery ||
      !payload.data.replacementShipmentNote?.trim()
    )
  ) {
    return res.status(400).json({
      message:
        "Replacement shipment requires courier, tracking number, dispatch date, estimated delivery date, and shipment note.",
    });
  }

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: { order: true, subOrder: { include: { brand: true } } },
  });
  if (!request) return res.status(404).json({ message: "Return request not found" });
  if (inferReturnRequestType(request) !== "EXCHANGE") {
    return res.status(409).json({ message: "Replacement shipment is only available for exchange requests." });
  }
  if ((request as any).convertedToRefund || (request as any).replacementUnavailable) {
    return res.status(409).json({ message: "Replacement shipment is unavailable because this exchange is on the refund path." });
  }

  if (
    !["RETURN_RECEIVED", "RETURN_CONDITION_APPROVED", "ADMIN_APPROVED", "REPLACEMENT_PROCESSING", "REPLACEMENT_PACKED", "REPLACEMENT_READY_FOR_PICKUP", "REPLACEMENT_SHIPPED", "REPLACEMENT_OUT_FOR_DELIVERY"].includes(request.status as string) &&
    !["REPLACEMENT_PROCESSING", "REPLACEMENT_PACKED", "REPLACEMENT_READY_FOR_PICKUP", "REPLACEMENT_SHIPPED", "REPLACEMENT_OUT_FOR_DELIVERY", "REPLACEMENT_DELIVERY_FAILED", "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED", "REPLACEMENT_READY_FOR_REDELIVERY"].includes(request.replacementStatus || "")
  ) {
    return res.status(409).json({ message: "Replacement shipment can be updated only after the returned item is approved." });
  }

  const currentWorkflowStatus = (request.replacementStatus as string | null) || (request.status as string);
  const allowedNextStatuses = nextReplacementStatuses[currentWorkflowStatus] || [];
  if (!allowedNextStatuses.length) {
    return res.status(409).json({ message: "No further replacement shipment updates are available for this request." });
  }
  if (!allowedNextStatuses.includes(payload.data.status)) {
    return res.status(409).json({ message: `Only the next replacement status (${allowedNextStatuses.join(", ")}) can be applied right now.` });
  }

  const normalizedFailureReason =
    payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
      ? normalizeDeliveryFailureReasonInput(payload.data.replacementFailureReason)
      : null;

  if (payload.data.status === "REPLACEMENT_DELIVERY_FAILED" && !normalizedFailureReason) {
    return res.status(400).json({
      message: "replacementFailureReason is required when replacement delivery fails.",
      availableReasons: DELIVERY_FAILURE_REASONS,
    });
  }

  if (
    payload.data.status === "REPLACEMENT_DELIVERY_FAILED" &&
    normalizedFailureReason === "OTHER" &&
    !payload.data.replacementFailureReasonMessage?.trim()
  ) {
    return res.status(400).json({
      message: "replacementFailureReasonMessage is required when replacementFailureReason is OTHER.",
      availableReasons: DELIVERY_FAILURE_REASONS,
    });
  }

  if (
    payload.data.status === "REPLACEMENT_DELIVERY_FAILED" &&
    normalizedFailureReason &&
    getDeliveryFailurePolicy(normalizedFailureReason).requiresAddressCorrection &&
    !payload.data.replacementShipmentNote?.trim()
  ) {
    return res.status(400).json({
      message: "A replacement shipment note is required for incorrect address failures so the address can be corrected.",
    });
  }

  let notificationNote = "";
  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    if (
      payload.data.status !== "REPLACEMENT_PROCESSING" &&
      currentWorkflowStatus !== "REPLACEMENT_PROCESSING" &&
      currentWorkflowStatus !== "REPLACEMENT_PACKED" &&
      currentWorkflowStatus !== "REPLACEMENT_READY_FOR_PICKUP" &&
      currentWorkflowStatus !== "REPLACEMENT_SHIPPED" &&
      currentWorkflowStatus !== "REPLACEMENT_OUT_FOR_DELIVERY" &&
      currentWorkflowStatus !== "REPLACEMENT_DELIVERY_FAILED" &&
      currentWorkflowStatus !== "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED" &&
      currentWorkflowStatus !== "REPLACEMENT_READY_FOR_REDELIVERY"
    ) {
      await dbTx.returnRequest.update({
        where: { id: request.id },
        data: {
          status: "REPLACEMENT_PROCESSING",
          replacementStatus: "REPLACEMENT_PROCESSING",
        },
      });

      await dbTx.returnStatusLog.create({
        data: {
          returnRequestId: request.id,
          status: "REPLACEMENT_PROCESSING",
          updatedBy: "BRAND",
          updatedById: req.auth!.userId,
          note: "Replacement shipment flow started.",
        },
      });

      await dbTx.returnHistory.create({
        data: {
          returnRequestId: request.id,
          oldStatus: request.status,
          newStatus: "REPLACEMENT_PROCESSING",
          performedByRole: "BRAND",
          performedById: req.auth!.userId,
          note: "Replacement shipment flow started.",
        },
      });
    }

    const now = new Date();
    const failurePolicy = normalizedFailureReason ? getDeliveryFailurePolicy(normalizedFailureReason) : null;
    const replacementAttempt = payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
      ? (request.replacementDeliveryAttempts || 0) + 1
      : request.replacementDeliveryAttempts || 0;
    const isFinalReplacementFailure = Boolean(
      payload.data.status === "REPLACEMENT_DELIVERY_FAILED" &&
      normalizedFailureReason &&
      replacementAttempt >= (failurePolicy?.maxAttempts ?? 1),
    );
    const effectiveReplacementStatus =
      payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
        ? normalizedFailureReason === "INCORRECT_ADDRESS"
          ? "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
          : isFinalReplacementFailure
            ? "REPLACEMENT_SHIPMENT_RETURNED"
            : "REPLACEMENT_DELIVERY_FAILED"
        : payload.data.status;
    const replacementNextAttemptDate =
      payload.data.status === "REPLACEMENT_DELIVERY_FAILED" && normalizedFailureReason && failurePolicy?.retryable && !isFinalReplacementFailure
        ? calculateNextAttemptDate(normalizedFailureReason, now)
        : null;
    const note =
      payload.data.status === "REPLACEMENT_PROCESSING"
        ? payload.data.replacementShipmentNote?.trim() || "Replacement processing started."
        : payload.data.status === "REPLACEMENT_PACKED"
          ? payload.data.replacementShipmentNote?.trim() || "Replacement packed and ready for dispatch."
          : payload.data.status === "REPLACEMENT_READY_FOR_PICKUP"
            ? payload.data.replacementShipmentNote?.trim() || "Replacement is ready for courier pickup."
            : payload.data.status === "REPLACEMENT_SHIPPED"
              ? `Replacement shipped via ${payload.data.replacementCourier} (${payload.data.replacementTrackingNo}).`
              : payload.data.status === "REPLACEMENT_OUT_FOR_DELIVERY"
                ? payload.data.replacementShipmentNote?.trim() || "Replacement is out for delivery."
                : payload.data.status === "REPLACEMENT_DELIVERY_FAILED" && normalizedFailureReason
                  ? buildBrandFailureMessage({
                      failureReason: normalizedFailureReason,
                      failureReasonMessage: payload.data.replacementFailureReasonMessage?.trim() || null,
                      paymentMethod: request.order.paymentMethod,
                      deliveryAttempt: replacementAttempt,
                      maxAttempts: failurePolicy?.maxAttempts ?? 1,
                      nextAttemptDate: replacementNextAttemptDate,
                      isFinalFailure: isFinalReplacementFailure,
                    })
                  : payload.data.status === "REPLACEMENT_READY_FOR_REDELIVERY"
                    ? payload.data.replacementShipmentNote?.trim() || "Replacement is ready for redelivery."
                    : payload.data.status === "REPLACEMENT_SHIPMENT_RETURNED"
                      ? payload.data.replacementShipmentNote?.trim() || "Replacement shipment was returned after delivery issues."
                      : payload.data.status === "REPLACEMENT_DELIVERED"
                        ? payload.data.replacementShipmentNote?.trim() || "Replacement delivered to the customer."
                        : payload.data.replacementShipmentNote?.trim() || "Replacement shipment updated.";
    notificationNote = note;

    await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: effectiveReplacementStatus,
        replacementStatus: effectiveReplacementStatus,
        replacementTrackingNo: payload.data.replacementTrackingNo?.trim() || request.replacementTrackingNo,
        replacementCourier: payload.data.replacementCourier?.trim() || request.replacementCourier,
        replacementDispatchDate: payload.data.replacementDispatchDate || request.replacementDispatchDate,
        replacementEstimatedDelivery: payload.data.replacementEstimatedDelivery || request.replacementEstimatedDelivery,
        replacementShipmentNote: payload.data.replacementShipmentNote?.trim() || request.replacementShipmentNote,
        replacementDeliveryAttempts:
          payload.data.status === "REPLACEMENT_OUT_FOR_DELIVERY"
            ? { increment: 1 }
            : undefined,
        replacementFailureReason:
          payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
            ? normalizedFailureReason
            : payload.data.status === "REPLACEMENT_OUT_FOR_DELIVERY" || payload.data.status === "REPLACEMENT_DELIVERED"
              ? null
              : undefined,
        replacementFailureReasonMessage:
          payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
            ? payload.data.replacementFailureReasonMessage?.trim() || null
            : payload.data.status === "REPLACEMENT_OUT_FOR_DELIVERY" || payload.data.status === "REPLACEMENT_DELIVERED"
              ? null
              : undefined,
        replacementNextAttemptDate:
          payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
            ? replacementNextAttemptDate
            : payload.data.status === "REPLACEMENT_OUT_FOR_DELIVERY" || payload.data.status === "REPLACEMENT_DELIVERED" || effectiveReplacementStatus === "REPLACEMENT_SHIPMENT_RETURNED"
              ? null
              : undefined,
        replacementLastAttemptAt:
          payload.data.status === "REPLACEMENT_OUT_FOR_DELIVERY"
            ? now
            : undefined,
        replacementDeliveryFailedAt:
          payload.data.status === "REPLACEMENT_DELIVERY_FAILED"
            ? now
            : undefined,
        replacementFinalFailureAt:
          effectiveReplacementStatus === "REPLACEMENT_SHIPMENT_RETURNED"
            ? now
            : undefined,
        replacementDeliveredAt:
          payload.data.status === "REPLACEMENT_DELIVERED"
            ? now
            : request.replacementDeliveredAt,
        completedAt:
          payload.data.status === "REPLACEMENT_DELIVERED"
            ? request.completedAt
            : request.completedAt,
        reviewNote: note,
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: effectiveReplacementStatus,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: effectiveReplacementStatus,
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note,
      },
    });

    return dbTx.returnRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
        subOrder: {
          include: {
            brand: true,
            items: {
              select: {
                id: true,
                quantity: true,
                selectedColor: true,
                selectedSize: true,
                unitPricePkr: true,
                product: { select: { id: true, name: true, imageUrl: true } },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amountPkr: true,
            adjustedAmountPkr: true,
            method: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note: notificationNote,
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/replacement-delivered", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const request = await prisma.returnRequest.findFirst({
    where: { id: String(req.params.returnRequestId), subOrder: { brandId: access.brandId } },
    include: { order: true, subOrder: { include: { brand: true } } },
  });

  if (!request) return res.status(404).json({ message: "Return request not found" });
  if (inferReturnRequestType(request) !== "EXCHANGE") {
    return res.status(409).json({ message: "Replacement delivery is only available for exchange requests." });
  }
  if (
    !["REPLACEMENT_SHIPPED", "REPLACEMENT_OUT_FOR_DELIVERY"].includes(request.status as string) &&
    !["REPLACEMENT_SHIPPED", "REPLACEMENT_OUT_FOR_DELIVERY"].includes(request.replacementStatus || "")
  ) {
    return res.status(409).json({ message: "Replacement can be marked delivered only after shipment is in progress." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const deliveredAt = new Date();
    const next = await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: "REPLACEMENT_DELIVERED",
        replacementStatus: "REPLACEMENT_DELIVERED",
        replacementDeliveredAt: deliveredAt,
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: "REPLACEMENT_DELIVERED",
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: "Replacement delivered to the customer.",
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: request.status,
        newStatus: "REPLACEMENT_DELIVERED",
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note: "Replacement delivered to the customer.",
      },
    });

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.subOrder.brandId,
    brandName: access.brand.name,
    note: "Replacement delivered.",
    changedByRole: "BRAND",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/orders/:orderId/status", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const orderIdentifier = String(req.params.orderId);

  const parsed = z
    .object({
      status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "ADDRESS_CORRECTION_REQUIRED", "READY_FOR_REDELIVERY", "DELIVERED", "SHIPMENT_RETURNED", "RETURNED", "CANCELED"]),
      trackingId: z.string().trim().min(4).max(120).optional(),
      courierName: z.string().trim().max(50).optional(),
      estimatedDelivery: z.coerce.date().optional(),
      note: z.string().trim().max(240).optional(),
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
  const courierChanged = parsed.data.courierName !== undefined && parsed.data.courierName !== order.courierName;
  const estimatedDeliveryChanged = parsed.data.estimatedDelivery !== undefined;

  const brandAllowedStatuses = BRAND_FULFILLMENT_STATUSES;

  if (status === OrderStatus.CANCELED) {
    return res.status(400).json({
      message:
        "Brand cancellation must use the dedicated cancel endpoint with a required reason (OUT_OF_STOCK or ITEM_DAMAGED).",
    });
  }

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


  if (!statusChanged && !trackingChanged && !courierChanged && !estimatedDeliveryChanged && !parsed.data.note) {
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
        effectiveStatus = OrderStatus.SHIPMENT_RETURNED;
      }
    }
    const now = new Date();
    const nextAttemptDate =
      status === OrderStatus.DELIVERY_FAILED && failurePolicy?.retryable && !isFinalDeliveryFailure
        ? calculateNextAttemptDate(failureReasonKey, now)
        : null;
    const estimatedDelivery = parsed.data.estimatedDelivery
      ?? order.estimatedDelivery
      ?? getAutoEstimatedDelivery(status, now);

    await tx.subOrder.update({
      where: { id: order.id },
      data: {
        status: effectiveStatus,
        trackingId,
        courierName: parsed.data.courierName ?? order.courierName,
        estimatedDelivery,
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
            : status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED || effectiveStatus === OrderStatus.SHIPMENT_RETURNED
              ? null
              : undefined,
        finalDeliveryFailureAt: isFinalDeliveryFailure || status === OrderStatus.SHIPMENT_RETURNED ? now : undefined,
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
              : undefined,
        }),
      },
    });

    await writeStatusHistory(tx, {
      subOrderId: order.id,
      oldStatus: order.status,
      newStatus: effectiveStatus,
      changedByRole: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
      changedById: req.auth!.userId,
      reason: status === OrderStatus.DELIVERY_FAILED ? failureReasonKey : undefined,
      note: parsed.data.note || undefined,
    });

    await recordCodRefusalIfNeeded(tx, {
      userId: order.order.user.id,
      paymentMethod: order.order.paymentMethod,
      failureReason: status === OrderStatus.DELIVERY_FAILED ? failureReasonKey : null,
      now,
    });

    if (effectiveStatus === OrderStatus.SHIPMENT_RETURNED && shouldCreateRefundForPayment(order.order.paymentMethod)) {
      const existingRefund = await tx.refundRequest.findFirst({
        where: {
          subOrderId: order.id,
          reasonCode: "DELIVERY_FAILURE",
          status: { in: ["PENDING", "APPROVED", "PROCESSING"] },
        },
        select: { id: true },
      });

      if (!existingRefund) {
        const refund = calculateRefundItems(order.items);
        if (refund.amountPkr > 0) {
          await createRefundRecord(tx, {
            orderId: order.orderId,
            subOrderId: order.id,
            requestedByRole: "SYSTEM",
            reasonCode: "DELIVERY_FAILURE",
            reasonText: describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage),
            method: getRefundMethodForPayment(order.order.paymentMethod),
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: "Auto-created after shipment returned from delivery failure.",
          });
        }
      }
    }

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
          customerNote: undefined,
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
    undefined,
  );

  if (statusChanged) {
    if (status === OrderStatus.DELIVERY_FAILED) {
      const failureReasonCode = normalizeDeliveryFailureReasonInput(parsed.data.failureReason) || "OTHER";
      const isFinal = updated.status === OrderStatus.SHIPMENT_RETURNED;
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
          name: notificationEventNames.orderShipmentReturned,
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

router.post("/orders/:orderId/cancel", async (req, res) => {
  try {
    const access = await getBrandAccess(req.auth!.userId);
    if (!access) return res.status(403).json({ message: "Brand access required" });

    const payload = z
      .object({
        reasonCode: z.enum(["OUT_OF_STOCK", "ITEM_DAMAGED", "WRONG_PRICE_LISTED", "CANNOT_FULFILL_ORDER", "ADDRESS_NOT_SERVICEABLE", "DUPLICATE_ORDER_ISSUE", "OTHER"]),
        note: z.string().trim().max(240).optional(),
        orderItemIds: z.array(z.string().trim().min(3)).min(1).optional(),
        refundMethod: z.enum(["ORIGINAL_SOURCE", "BANK_TRANSFER", "WALLET_CREDIT"]).optional(),
      })
      .safeParse(req.body || {});

    if (!payload.success) {
      return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
    }

    if (payload.data.reasonCode === "OTHER" && !payload.data.note?.trim()) {
      return res.status(400).json({ message: "note is required when reasonCode is OTHER." });
    }

    const subOrder = await prisma.subOrder.findFirst({
      where: {
        brandId: access.brandId,
        OR: [{ id: String(req.params.orderId) }, { orderId: String(req.params.orderId) }],
      },
      include: {
        order: true,
        brand: true,
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });
    if (!subOrder) return res.status(404).json({ message: "Order not found" });
    const directCancelStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING];
    const requestCancelStatuses: OrderStatus[] = [OrderStatus.PACKED, OrderStatus.READY_FOR_PICKUP];
    if (!directCancelStatuses.includes(subOrder.status) && !requestCancelStatuses.includes(subOrder.status)) {
      return res.status(409).json({ message: "Brand can cancel only before shipment." });
    }

    if (requestCancelStatuses.includes(subOrder.status)) {
      const request = await prisma.$transaction(async (tx) => {
        const existing = await tx.cancellationRequest.findFirst({
          where: { subOrderId: subOrder.id, status: { in: ["REQUESTED"] } },
          include: { history: { orderBy: { createdAt: "desc" } } },
        });
        if (existing) return existing;

        const now = new Date();
        const created = await tx.cancellationRequest.create({
          data: {
            orderId: subOrder.orderId,
            subOrderId: subOrder.id,
            brandId: subOrder.brandId,
            requestedByRole: "BRAND",
            requestedById: req.auth!.userId,
            reasonCode: payload.data.reasonCode,
            reasonText: payload.data.note?.trim() || null,
            expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
            autoApproveAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
          },
        });

        await tx.cancellationHistory.create({
          data: {
            cancellationRequestId: created.id,
            action: "CREATED",
            performedByRole: "BRAND",
            performedById: req.auth!.userId,
            note: payload.data.note?.trim() || payload.data.reasonCode,
          },
        });

        return tx.cancellationRequest.findUniqueOrThrow({
          where: { id: created.id },
          include: { history: { orderBy: { createdAt: "desc" } } },
        });
      });

      queueNotificationEvent({
        name: notificationEventNames.cancellationRequestCreated,
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        userId: subOrder.order.userId,
        brandId: subOrder.brandId,
        brandName: subOrder.brand.name,
        changedByRole: "BRAND",
        note: `Brand requested cancellation (${payload.data.reasonCode})${payload.data.note ? `: ${payload.data.note}` : ""}`,
        notifyAdmin: true,
      });

      return res.status(202).json({ data: { success: true, cancellationRequest: request } });
    }

    const selectedItems = payload.data.orderItemIds?.length
      ? subOrder.items.filter((item) => payload.data.orderItemIds!.includes(item.id))
      : subOrder.items;

    if (!selectedItems.length) {
      return res.status(400).json({ message: "No valid order items selected for cancellation." });
    }

    if (payload.data.orderItemIds?.length && selectedItems.length !== payload.data.orderItemIds.length) {
      return res.status(400).json({ message: "Some selected items do not belong to this vendor group." });
    }

    const isPartialCancellation = selectedItems.length < subOrder.items.length;
    const cancelledAmountPkr = selectedItems.reduce((sum, item) => sum + item.unitPricePkr * item.quantity, 0);
    if (cancelledAmountPkr <= 0) {
      return res.status(400).json({ message: "Selected items are invalid for cancellation." });
    }
    const reasonLabel = payload.data.reasonCode.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    const cancelledItemNames = selectedItems.map((item) => item.product.name).filter(Boolean).join(", ");
    const cancelledItemIds = selectedItems.map((item) => item.id);

    const cancellationSummary = await prisma.$transaction(async (tx) => {
    if (isPartialCancellation) {
      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: {
          subtotalPkr: { decrement: cancelledAmountPkr },
        },
      });
    } else {
      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: { status: OrderStatus.CANCELED },
      });
    }

    await tx.subOrderStatusLog.create({
      data: {
        subOrderId: subOrder.id,
        status: isPartialCancellation ? subOrder.status : OrderStatus.CANCELED,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: isPartialCancellation
          ? `CANCELLED_ITEMS:${cancelledItemIds.join(",")} | Partial item cancellation by brand: ${reasonLabel}${payload.data.note ? ` (${payload.data.note})` : ""}`
          : `Brand cancellation: ${payload.data.reasonCode}${payload.data.note ? ` (${payload.data.note})` : ""}`,
      },
    });

    if (!isPartialCancellation) {
      await writeStatusHistory(tx, {
        subOrderId: subOrder.id,
        oldStatus: subOrder.status,
        newStatus: OrderStatus.CANCELED,
        changedByRole: "BRAND",
        changedById: req.auth!.userId,
        reason: payload.data.reasonCode,
        note: payload.data.note?.trim() || reasonLabel,
      });
    }

    for (const item of selectedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    const refreshedSubOrders = await tx.subOrder.findMany({
      where: { orderId: subOrder.orderId },
      select: { status: true, trackingId: true },
    });
    const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((entry) => entry.status));
    await tx.order.update({
      where: { id: subOrder.orderId },
      data: {
        status: nextParentStatus,
        totalPkr: { decrement: cancelledAmountPkr },
      },
    });
    await tx.orderStatusLog.create({
      data: {
        orderId: subOrder.orderId,
        status: nextParentStatus,
        updatedBy: "BRAND",
        updatedById: req.auth!.userId,
        note: isPartialCancellation
          ? `Vendor group (${access.brand.name}) partially canceled by brand: ${reasonLabel}`
          : `Vendor group (${access.brand.name}) canceled by brand: ${payload.data.reasonCode}`,
      },
    });

    return {
      allVendorGroupsCanceled: refreshedSubOrders.every((entry) => entry.status === OrderStatus.CANCELED),
    };
  });

    const shouldCreateRefund = subOrder.order.paymentMethod !== "COD";

    if (shouldCreateRefund) {
    try {
      const existingRefund = await prisma.refundRequest.findFirst({
        where: { subOrderId: subOrder.id, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
        select: { id: true },
      });

      if (!existingRefund) {
        const method =
          payload.data.refundMethod ||
          (subOrder.order.paymentMethod === "COD" ? "BANK_TRANSFER" : "ORIGINAL_SOURCE");
        const refund = calculateRefundItems(selectedItems);
        if (refund.amountPkr > 0) {
          await prisma.$transaction(async (tx) => {
            await createRefundRecord(tx, {
            orderId: subOrder.orderId,
            subOrderId: subOrder.id,
            requestedByRole: "BRAND",
            requestedById: req.auth!.userId,
            reasonCode: "BRAND_CANCELLATION",
            reasonText: payload.data.reasonCode,
            method,
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: payload.data.note?.trim() || payload.data.reasonCode,
            });
          });
        }
      }
    } catch (refundError) {
      console.error("[brand-dashboard] refund workflow failed after cancellation", {
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        error: refundError instanceof Error ? refundError.message : String(refundError),
      });
    }
    }

    const shouldNotifyCancellation = !(isPartialCancellation && subOrder.order.paymentMethod === "COD");

    if (shouldNotifyCancellation) {
      queueNotificationEvent({
      name: notificationEventNames.orderCancelled,
      orderId: subOrder.orderId,
      subOrderId: cancellationSummary.allVendorGroupsCanceled ? undefined : subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "BRAND",
      note: isPartialCancellation
        ? `PARTIAL_ITEM_CANCEL|items=${cancelledItemNames}|reason=${reasonLabel}${payload.data.note ? `|note=${payload.data.note}` : ""}`
        : `Canceled by brand (${payload.data.reasonCode})${payload.data.note ? `: ${payload.data.note}` : ""}`,
      notifyAdmin: true,
    });
    }

    if (shouldCreateRefund) {
      queueNotificationEvent({
      name: notificationEventNames.refundStateUpdated,
      orderId: subOrder.orderId,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      paymentMethod: subOrder.order.paymentMethod,
      reason: "Refund request created: pending admin validation.",
    });
    }

    return res.status(201).json({ data: { success: true } });
  } catch (error) {
    console.error("[brand-dashboard] cancel order failed", {
      orderId: req.params.orderId,
      userId: req.auth?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Unable to cancel order right now. Please try again." });
  }
});

router.get("/products", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const products = await prisma.product.findMany({
    where: { brandId: access.brandId },
    include: productStructureInclude,
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

  const product = await createProduct(parsed.data, access.brandId, {
    approvalStatus: "PENDING",
    isActive: false,
    source: "brand_upload",
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

  await updateProduct(product.id, parsed.data);
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      approvalStatus: "PENDING" as const,
      isActive: false,
      source: "brand_upload",
    },
    include: productStructureInclude,
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

router.get("/notifications/unread-count", async (req, res) => {
  const access = await getBrandAccess(req.auth!.userId);
  if (!access) return res.status(403).json({ message: "Brand access required" });

  const count = await prisma.notification.count({
    where: {
      OR: [{ userId: req.auth!.userId }, { brandId: access.brandId }],
      readAt: null,
    },
  });

  return res.json({ data: { count } });
});

export default router;
