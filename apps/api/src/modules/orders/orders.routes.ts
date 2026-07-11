import { Router } from "express";
import { OrderStatus, PaymentSessionStatus, PaymentStatus, Prisma, UserActivityEventType } from "@prisma/client";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { createUserAndIpRateLimiters } from "../../middleware/rate-limit.js";
import { addCartItem, getCart, getCartScopeFromUser, syncCheckoutCart } from "../carts/cart.service.js";
import { incrementProductPurchaseAnalytics } from "../products/analytics.service.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import {
  DELIVERY_FAILURE_REASONS,
  buildCustomerFailureMessage,
  calculateNextAttemptDate,
  describeFailureReason,
  getDeliveryFailurePolicy,
  normalizeDeliveryFailureReasonInput,
} from "./deliveryFailure.service.js";
import {
  AUTO_CANCELLABLE_STATUSES,
  BRAND_FULFILLMENT_STATUSES,
  CANCELLATION_REQUEST_STATUSES,
  SUBORDER_TRANSITIONS,
  calculateRefundItems,
  createRefundRecord,
  deriveParentOrderStatus as deriveLifecycleParentOrderStatus,
  getCancellationMode,
  getRefundMethodForPayment,
  recordCodRefusalIfNeeded,
  shouldCreateRefundForPayment,
  writeStatusHistory,
} from "./order-lifecycle.service.js";
import {
  deriveExchangeResolutionForReason,
  deriveExchangeType,
  inferReturnRequestType,
  normalizeReturnRequestForApi,
} from "./return-workflow.js";
import { trackUserActivity } from "../recommendations/recommendation.service.js";
import { creditWallet } from "../users/wallet.service.js";

const router = Router();
const [orderPlacementIpLimit, orderPlacementUserLimit] = createUserAndIpRateLimiters("orders-create", 60_000, 10, 30);

const cancelReasonCodeSchema = z.enum([
  "CHANGED_MIND",
  "ORDERED_BY_MISTAKE",
  "WRONG_SIZE_SELECTED",
  "WRONG_COLOR_SELECTED",
  "FOUND_BETTER_PRICE",
  "DELIVERY_TOO_SLOW",
  "PAYMENT_ISSUE",
  "OTHER",
]);

const returnReasonCodeSchema = z.enum([
  "DAMAGED_ITEM",
  "DEFECTIVE_PRODUCT",
  "WRONG_ITEM",
  "WRONG_SIZE",
  "WRONG_COLOR",
  "SIZE_ISSUE",
  "DIFFERENT_FROM_IMAGES",
  "QUALITY_ISSUE",
  "CHANGED_MIND",
  "OTHER",
]);

const cancelReasonLabelByCode: Record<z.infer<typeof cancelReasonCodeSchema>, string> = {
  CHANGED_MIND: "Changed my mind",
  ORDERED_BY_MISTAKE: "Ordered by mistake",
  WRONG_SIZE_SELECTED: "Wrong size selected",
  WRONG_COLOR_SELECTED: "Wrong color selected",
  FOUND_BETTER_PRICE: "Found a better price",
  DELIVERY_TOO_SLOW: "Delivery is taking too long",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other",
};

const paymentMethodSchema = z.enum(["COD", "JAZZCASH", "EASYPAISA"]);
const brandOrderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERY_FAILED",
  "DELIVERED",
  "ADDRESS_CORRECTION_REQUIRED",
  "READY_FOR_REDELIVERY",
  "SHIPMENT_RETURNED",
  "RETURNED",
  "CANCELED",
  "CANCELLED",
]);
const orderTransitionMap: Record<OrderStatus, OrderStatus[]> = SUBORDER_TRANSITIONS;
const MAX_DELIVERY_ATTEMPTS = 3;
const PAYMENT_RETRY_WINDOW_MS = 30 * 60 * 1000;
const DEMO_PAYMENT_GATEWAY = "DEMO_GATEWAY";

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

function normalizeStatus(status: z.infer<typeof brandOrderStatusSchema>): OrderStatus {
  return status === "CANCELLED" ? "CANCELED" : status;
}

function composeStatusNote(note?: string, trackingId?: string | null) {
  const parts: string[] = [];
  if (trackingId) parts.push(`Tracking ID: ${trackingId}`);
  if (note) parts.push(note);
  return parts.join(" | ") || undefined;
}

function composeCancellationReason(reasonCode?: z.infer<typeof cancelReasonCodeSchema>, customReason?: string, fallback?: string) {
  const reasonLabel = reasonCode ? cancelReasonLabelByCode[reasonCode] : null;
  const custom = customReason?.trim();

  if (reasonLabel && reasonCode === "OTHER" && custom) {
    return `${reasonLabel}: ${custom}`;
  }

  if (reasonLabel) {
    return reasonLabel;
  }

  if (custom) {
    return custom;
  }

  return fallback;
}

function mapCustomerCancellationReasonCode(reasonCode?: z.infer<typeof cancelReasonCodeSchema>) {
  if (!reasonCode || reasonCode === "DELIVERY_TOO_SLOW") return "DELIVERY_TIME_TOO_LONG" as const;
  if (reasonCode === "PAYMENT_ISSUE") return "OTHER" as const;
  return reasonCode;
}

function getCancellationRequestDeadlines(now = new Date()) {
  return {
    expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    autoApproveAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
  };
}

function extractCustomerVisibleNote(note?: string | null) {
  if (!note) return null;
  const marker = "CUSTOMER_NOTE:";
  const index = note.indexOf(marker);
  if (index === -1) return null;
  const value = note.slice(index + marker.length).trim();
  return value || null;
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


const DEFAULT_RETURN_WINDOW_DAYS = 7;
const NON_RETURNABLE_CATEGORY_PATTERNS = [
  /innerwear/i,
  /underwear/i,
  /undergarment/i,
  /clearance/i,
  /\bsale\b/i,
  /custom/i,
  /personal/i,
  /earring/i,
];

function isDefaultNonReturnableProduct(product: {
  topCategory?: string | null;
  subCategory?: string | null;
  type?: string | null;
  label?: string | null;
  tags?: string[] | null;
}) {
  const values = [product.topCategory, product.subCategory, product.type, product.label, ...(product.tags || [])]
    .filter(Boolean)
    .join(" ");
  return NON_RETURNABLE_CATEGORY_PATTERNS.some((pattern) => pattern.test(values));
}

function getDeliveredAt(subOrder: { updatedAt: Date; statusLogs?: Array<{ status: OrderStatus; createdAt: Date }> }) {
  return subOrder.statusLogs?.find((log) => log.status === OrderStatus.DELIVERED)?.createdAt || subOrder.updatedAt;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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
    case OrderStatus.RETURNED:
    case OrderStatus.SHIPMENT_RETURNED:
      return `Your ${brandName} item has been returned.`;
    case OrderStatus.CANCELED:
      return `Your ${brandName} item has been canceled.`;
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

function normalizePaymentSignaturePayload(input: {
  orderId: string;
  paymentMethod: string;
  gatewayTransactionId: string;
  amountPkr: number;
  status: string;
}) {
  return `${input.orderId}:${input.paymentMethod}:${input.gatewayTransactionId}:${input.amountPkr}:${input.status}`;
}

function normalizeWebhookSignature(signature?: string) {
  const value = signature?.trim() || "";
  return value.startsWith("sha256=") ? value.slice("sha256=".length) : value;
}

function isValidPaymentWebhookSignature(payload: ReturnType<typeof normalizePaymentSignaturePayload>, signature?: string) {
  const normalizedSignature = normalizeWebhookSignature(signature);
  if (!normalizedSignature) return false;

  const secret = env.paymentWebhookSecret || env.demoGatewaySecret;
  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expected = Buffer.from(digest);
  const actual = Buffer.from(normalizedSignature);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function signDemoGatewayPayload(payload: ReturnType<typeof normalizePaymentSignaturePayload>) {
  return crypto.createHmac("sha256", env.demoGatewaySecret).update(payload).digest("hex");
}

function buildDemoPaymentRedirect(sessionId: string) {
  return `${env.webAppUrl.replace(/\/$/, "")}/checkout/demo-payment?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildGatewayTransactionId(orderId: string, attemptNumber: number) {
  return `demo_${orderId}_${attemptNumber}_${Date.now()}`;
}

async function expirePaymentSessionIfNeeded(sessionId: string) {
  const session = await prisma.paymentSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;
  if (session.status !== PaymentSessionStatus.PENDING) return session;
  if (session.expiresAt.getTime() > Date.now()) return session;

  return prisma.paymentSession.update({
    where: { id: sessionId },
    data: {
      status: PaymentSessionStatus.EXPIRED,
      failedAt: new Date(),
      lastErrorReason: "Payment session expired",
    },
  });
}

async function createPaymentSession(input: {
  orderId: string;
  userId: string;
  paymentMethod: "JAZZCASH" | "EASYPAISA";
}) {
  const existingSessions = await prisma.paymentSession.findMany({
    where: { orderId: input.orderId },
    orderBy: { createdAt: "asc" },
    select: { attemptNumber: true },
  });

  const attemptNumber = existingSessions.length + 1;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PAYMENT_RETRY_WINDOW_MS);

  const created = await prisma.paymentSession.create({
    data: {
      orderId: input.orderId,
      userId: input.userId,
      paymentMethod: input.paymentMethod,
      gateway: DEMO_PAYMENT_GATEWAY,
      gatewayTransactionId: buildGatewayTransactionId(input.orderId, attemptNumber),
      status: PaymentSessionStatus.PENDING,
      redirectUrl: buildDemoPaymentRedirect("pending"),
      expiresAt,
      attemptNumber,
    },
  });

  return prisma.paymentSession.update({
    where: { id: created.id },
    data: {
      redirectUrl: buildDemoPaymentRedirect(created.id),
    },
  });
}

async function attachPaymentRetryMetadata<T extends { id: string; paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA"; paymentStatus: PaymentStatus }>(
  order: T,
) {
  if (order.paymentMethod === "COD") {
    return {
      ...order,
      paymentRetryEligible: false,
      paymentRetryExpiresAt: null,
    };
  }

  const firstSession = await prisma.paymentSession.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!firstSession) {
    return {
      ...order,
      paymentRetryEligible: false,
      paymentRetryExpiresAt: null,
    };
  }

  const paymentRetryExpiresAt = new Date(firstSession.createdAt.getTime() + PAYMENT_RETRY_WINDOW_MS);
  return {
    ...order,
    paymentRetryEligible: order.paymentStatus !== PaymentStatus.COMPLETED && paymentRetryExpiresAt.getTime() > Date.now(),
    paymentRetryExpiresAt,
  };
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

async function getAllowedBrandIdsForUser(userId: string, brandId?: string | null) {
  if (brandId) return [brandId];

  const memberships = await prisma.brandMember.findMany({
    where: { userId },
    select: { brandId: true },
  });

  return memberships.map((membership) => membership.brandId);
}

router.post("/payments/webhook", async (req, res) => {
  const parsed = z
    .object({
      orderId: z.string().trim().min(3),
      paymentMethod: paymentMethodSchema,
      gatewayTransactionId: z.string().trim().min(3).max(160),
      amountPkr: z.number().int().positive(),
      status: z.enum(["VERIFIED", "SUCCESS", "FAILED", "CANCELLED", "TIMEOUT"]),
      reason: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payment webhook payload", issues: parsed.error.flatten() });
  }

  const signaturePayload = normalizePaymentSignaturePayload(parsed.data);
  const signature = String(req.header("x-broady-signature") || req.header("x-broady-payment-signature") || req.body?.signature || "");
  if (!isValidPaymentWebhookSignature(signaturePayload, signature)) {
    return res.status(401).json({ message: "Invalid payment webhook signature" });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      subOrders: { include: { brand: true, items: true } },
      paymentTransactions: {
        where: { gatewayTransactionId: parsed.data.gatewayTransactionId },
        take: 1,
      },
      paymentSessions: {
        where: { gatewayTransactionId: parsed.data.gatewayTransactionId },
        take: 1,
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.paymentMethod !== parsed.data.paymentMethod) {
    return res.status(409).json({ message: "Payment method does not match order" });
  }
  if (order.paymentMethod === "COD") {
    return res.status(409).json({ message: "COD orders do not use payment webhooks" });
  }
  if (order.totalPkr !== parsed.data.amountPkr) {
    return res.status(409).json({ message: "Payment amount does not match order total" });
  }

  if (order.paymentTransactions.length > 0) {
    return res.json({ data: { accepted: true, duplicate: true, orderId: order.id, status: order.status } });
  }

  const paymentVerified = parsed.data.status === "VERIFIED" || parsed.data.status === "SUCCESS";
  const matchedSession = order.paymentSessions[0] || null;
  const resolvedSessionStatus =
    parsed.data.status === "SUCCESS" || parsed.data.status === "VERIFIED"
      ? PaymentSessionStatus.COMPLETED
      : parsed.data.status === "FAILED"
        ? PaymentSessionStatus.FAILED
        : parsed.data.status === "CANCELLED"
          ? PaymentSessionStatus.CANCELLED
          : PaymentSessionStatus.TIMEOUT;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        gateway: parsed.data.paymentMethod,
        gatewayTransactionId: parsed.data.gatewayTransactionId,
        status: parsed.data.status,
        amountPkr: parsed.data.amountPkr,
        rawPayload: req.body as Prisma.InputJsonValue,
      },
    });

    if (matchedSession) {
      await tx.paymentSession.update({
        where: { id: matchedSession.id },
        data: {
          status: resolvedSessionStatus,
          completedAt: paymentVerified ? new Date() : matchedSession.completedAt,
          failedAt: paymentVerified ? matchedSession.failedAt : new Date(),
          lastErrorReason: paymentVerified ? null : parsed.data.reason || `Payment ${parsed.data.status.toLowerCase()}`,
        },
      });
    }

    if (!paymentVerified) {
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.FAILED, status: OrderStatus.PENDING },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          updatedBy: "SYSTEM",
          note: parsed.data.reason || "Payment failed; order remains pending for retry",
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    await tx.subOrder.updateMany({
      where: { orderId: order.id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CONFIRMED },
    });

    for (const subOrder of order.subOrders.filter((entry) => entry.status === OrderStatus.PENDING)) {
      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: subOrder.id,
          status: OrderStatus.CONFIRMED,
          updatedBy: "SYSTEM",
          note: "Payment verified by gateway webhook",
        },
      });
    }

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CONFIRMED,
        updatedBy: "SYSTEM",
        note: "Payment verified by gateway webhook",
      },
    });

    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });

  if (paymentVerified) {
    queueNotificationEvent({
      name: notificationEventNames.paymentSuccess,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: order.paymentMethod,
    });
    queueNotificationEvent({
      name: notificationEventNames.orderConfirmed,
      orderId: order.id,
      userId: order.userId,
      changedByRole: "SYSTEM",
      note: "Payment verified.",
      notifyAdmin: true,
    });
  } else {
    queueNotificationEvent({
      name: notificationEventNames.paymentFailed,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: order.paymentMethod,
      reason: parsed.data.reason,
    });
  }

  return res.json({ data: { accepted: true, orderId: updated.id, status: updated.status, paymentStatus: updated.paymentStatus } });
});

router.post("/payments/demo/:orderId/result", requireAuth, async (req, res) => {
  const payload = z
    .object({
      sessionId: z.string().trim().min(3),
      result: z.enum(["SUCCESS", "FAILED", "CANCELLED", "TIMEOUT"]),
      paymentMethod: paymentMethodSchema.optional(),
      reason: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid demo payment payload", issues: payload.error.flatten() });
  }

  const order = await prisma.order.findUnique({
    where: { id: String(req.params.orderId) },
    select: {
      id: true,
      userId: true,
      paymentMethod: true,
      totalPkr: true,
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.userId !== req.auth!.userId) return res.status(403).json({ message: "You do not have access to this payment session" });
  if (order.paymentMethod === "COD") return res.status(409).json({ message: "COD orders do not use the demo gateway" });
  if (payload.data.paymentMethod && payload.data.paymentMethod !== order.paymentMethod) {
    return res.status(409).json({ message: "Payment method does not match order" });
  }

  const session = await expirePaymentSessionIfNeeded(payload.data.sessionId);
  if (!session || session.orderId !== order.id || session.userId !== req.auth!.userId) {
    return res.status(404).json({ message: "Payment session not found" });
  }
  if (session.status !== PaymentSessionStatus.PENDING) {
    return res.status(409).json({ message: "This payment session is no longer active." });
  }

  const callbackPayload = {
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    gatewayTransactionId: session.gatewayTransactionId,
    amountPkr: order.totalPkr,
    status: payload.data.result,
    reason: payload.data.reason || (payload.data.result === "SUCCESS" ? "Demo payment succeeded" : `Demo payment ${payload.data.result.toLowerCase()}`),
  };
  const signaturePayload = normalizePaymentSignaturePayload(callbackPayload);
  const signature = `sha256=${signDemoGatewayPayload(signaturePayload)}`;
  const webhookUrl = `${req.protocol}://${req.get("host")}/api/orders/payments/webhook`;

  const webhookResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Broady-Signature": signature,
    },
    body: JSON.stringify(callbackPayload),
  });
  const webhookBody = await webhookResponse.json().catch(() => ({ message: "Webhook response was not JSON" }));

  return res.status(webhookResponse.status).json({
    data: {
      sessionId: session.id,
      callback: callbackPayload,
      webhook: webhookBody,
    },
  });
});

router.get("/payment-sessions/:sessionId", requireAuth, async (req, res) => {
  const session = await expirePaymentSessionIfNeeded(String(req.params.sessionId));
  if (!session || session.userId !== req.auth!.userId) {
    return res.status(404).json({ message: "Payment session not found" });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: session.orderId,
      userId: req.auth!.userId,
    },
    include: {
      items: {
        include: {
          product: true,
          brand: true,
        },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const firstSession = await prisma.paymentSession.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const retryExpiresAt = firstSession
    ? new Date(firstSession.createdAt.getTime() + PAYMENT_RETRY_WINDOW_MS)
    : session.expiresAt;

  return res.json({
    data: {
      ...session,
      retryEligible: order.paymentStatus !== PaymentStatus.COMPLETED && retryExpiresAt.getTime() > Date.now(),
      retryExpiresAt,
      order,
    },
  });
});

router.post("/me/:orderId/retry-payment", requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      paymentTransactions: true,
      paymentSessions: {
        orderBy: { createdAt: "asc" },
      },
      subOrders: {
        select: { status: true },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.paymentMethod === "COD") return res.status(409).json({ message: "COD orders do not need payment retry." });
  if (order.paymentStatus === PaymentStatus.COMPLETED || order.paymentTransactions.some((entry) => entry.status === "SUCCESS" || entry.status === "VERIFIED")) {
    return res.status(409).json({ message: "This order has already been paid." });
  }
  if (order.subOrders.some((subOrder) => subOrder.status !== OrderStatus.PENDING)) {
    return res.status(409).json({ message: "Payment retry is only available while all vendor groups remain pending." });
  }

  const firstSession = order.paymentSessions[0];
  if (!firstSession) {
    return res.status(409).json({ message: "No initial payment session was found for this order." });
  }

  const retryExpiresAt = new Date(firstSession.createdAt.getTime() + PAYMENT_RETRY_WINDOW_MS);
  if (retryExpiresAt.getTime() <= Date.now()) {
    return res.status(409).json({ message: "The 30-minute retry window has expired for this order." });
  }

  const latestSession = order.paymentSessions[order.paymentSessions.length - 1];
  if (latestSession && latestSession.status === PaymentSessionStatus.PENDING && latestSession.expiresAt.getTime() > Date.now()) {
    return res.json({
      data: {
        sessionId: latestSession.id,
        redirectUrl: latestSession.redirectUrl,
        retryExpiresAt,
      },
    });
  }

  const session = await createPaymentSession({
    orderId: order.id,
    userId: order.userId,
    paymentMethod: order.paymentMethod,
  });

  queueNotificationEvent({
    name: notificationEventNames.paymentInitiated,
    orderId: order.id,
    userId: order.userId,
    paymentMethod: order.paymentMethod,
  });

  return res.status(201).json({
    data: {
      sessionId: session.id,
      redirectUrl: session.redirectUrl,
      retryExpiresAt,
    },
  });
});

router.post("/", requireAuth, orderPlacementIpLimit, orderPlacementUserLimit, async (req, res) => {
  const schema = z.object({
    paymentMethod: paymentMethodSchema,
    deliveryAddress: z.string().min(10),
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().min(1),
          selectedColor: z.string().trim().min(1).max(60).optional(),
          selectedSize: z.string().trim().min(1).max(40).optional(),
        }),
      )
      .min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const products = await prisma.product.findMany({
    where: {
      id: { in: parsed.data.items.map((item) => item.productId) },
      isActive: true,
      approvalStatus: "APPROVED",
    },
    include: { brand: true },
  });

  const productById = (productId: string) => {
    for (const product of products) {
      if (product.id === productId) return product;
    }
    return null;
  };

  const invalidProductIds = parsed.data.items
    .map((item) => item.productId)
    .filter((productId) => !productById(productId));

  if (invalidProductIds.length) {
    return res.status(400).json({ message: "One or more products are invalid or inactive" });
  }

  for (const item of parsed.data.items) {
    const product = productById(item.productId);
    if (!product || product.stock < item.quantity) {
      return res.status(409).json({ message: "One or more items are out of stock" });
    }
  }

  const subtotal = parsed.data.items.reduce((total, item) => {
    const product = productById(item.productId);
    if (!product) return total;
    return total + product.pricePkr * item.quantity;
  }, 0);

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const item of parsed.data.items) {
        const product = productById(item.productId);
        if (!product) {
          throw new Error("INVALID_PRODUCT");
        }

        const stockUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            approvalStatus: "APPROVED",
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (stockUpdate.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const created = await tx.order.create({
        data: {
          userId: req.auth!.userId,
          status: parsed.data.paymentMethod === "COD" ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: parsed.data.paymentMethod === "COD" ? PaymentStatus.BRAND_COLLECTS_COD : PaymentStatus.PENDING,
          deliveryAddress: parsed.data.deliveryAddress,
          totalPkr: subtotal,
        },
      });

      const byBrand = new Map<
        string,
        {
          subtotalPkr: number;
          items: Array<{ productId: string; quantity: number; unitPricePkr: number; selectedColor?: string; selectedSize?: string }>;
        }
      >();

      for (const item of parsed.data.items) {
        const product = productById(item.productId);
        if (!product) {
          throw new Error("INVALID_PRODUCT");
        }

        const existing = byBrand.get(product.brandId);
        const lineSubtotal = product.pricePkr * item.quantity;
        if (!existing) {
          byBrand.set(product.brandId, {
            subtotalPkr: lineSubtotal,
            items: [
              {
                productId: product.id,
                quantity: item.quantity,
                unitPricePkr: product.pricePkr,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
              },
            ],
          });
        } else {
          existing.subtotalPkr += lineSubtotal;
          existing.items.push({
            productId: product.id,
            quantity: item.quantity,
            unitPricePkr: product.pricePkr,
            selectedColor: item.selectedColor,
            selectedSize: item.selectedSize,
          });
        }
      }

      for (const [brandId, group] of byBrand.entries()) {
        const subOrder = await tx.subOrder.create({
          data: {
            orderId: created.id,
            brandId,
            status: parsed.data.paymentMethod === "COD" ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
            subtotalPkr: group.subtotalPkr,
          },
        });

        await tx.orderItem.createMany({
          data: group.items.map((item) => ({
            orderId: created.id,
            subOrderId: subOrder.id,
            productId: item.productId,
            brandId,
            quantity: item.quantity,
            unitPricePkr: item.unitPricePkr,
            selectedColor: item.selectedColor || null,
            selectedSize: item.selectedSize || null,
          })),
        });

        await tx.subOrderStatusLog.create({
          data: {
            subOrderId: subOrder.id,
            status: OrderStatus.PENDING,
            updatedBy: "SYSTEM",
            updatedById: req.auth!.userId,
            note: "Vendor group created from checkout",
          },
        });

        if (parsed.data.paymentMethod === "COD") {
          await tx.subOrderStatusLog.create({
            data: {
              subOrderId: subOrder.id,
              status: OrderStatus.CONFIRMED,
              updatedBy: "SYSTEM",
              updatedById: req.auth!.userId,
              note: "COD order auto-confirmed by system",
            },
          });
        }
      }

      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: OrderStatus.PENDING,
          updatedBy: "SYSTEM",
          updatedById: req.auth!.userId,
          note: "Order placed by customer",
        },
      });

      if (parsed.data.paymentMethod === "COD") {
        await tx.orderStatusLog.create({
          data: {
            orderId: created.id,
            status: OrderStatus.CONFIRMED,
            updatedBy: "SYSTEM",
            updatedById: req.auth!.userId,
            note: "COD order auto-confirmed by system",
          },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          items: {
            include: { product: { include: { brand: true } }, brand: true },
          },
          subOrders: {
            include: {
              brand: true,
              items: { include: { product: true } },
              statusLogs: { orderBy: { createdAt: "desc" } },
            },
            orderBy: { createdAt: "asc" },
          },
          statusLogs: { orderBy: { createdAt: "desc" } },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "INSUFFICIENT_STOCK" || error.message === "INVALID_PRODUCT")) {
      return res.status(409).json({ message: "Unable to place order due to stock changes. Please review your cart." });
    }
    throw error;
  }

  const paymentSession =
    parsed.data.paymentMethod === "COD"
      ? null
      : await createPaymentSession({
        orderId: order.id,
        userId: order.userId,
        paymentMethod: parsed.data.paymentMethod,
      });
  const paymentRedirect = paymentSession?.redirectUrl || null;

  queueNotificationEvent({
    name: notificationEventNames.orderPlaced,
    orderId: order.id,
    userId: order.userId,
    changedByRole: "USER",
  });

  if (parsed.data.paymentMethod === "COD") {
    queueNotificationEvent({
      name: notificationEventNames.orderConfirmed,
      orderId: order.id,
      userId: order.userId,
      changedByRole: "SYSTEM",
      note: "COD order auto-confirmed.",
      notifyAdmin: true,
    });
  } else {
    queueNotificationEvent({
      name: notificationEventNames.paymentInitiated,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: parsed.data.paymentMethod,
    });
  }

  await trackUserActivity({
    userId: req.auth!.userId,
    eventType: UserActivityEventType.ORDER_PLACED,
    sourcePage: "checkout",
    metadata: {
      orderId: order.id,
      itemCount: parsed.data.items.length,
      paymentMethod: parsed.data.paymentMethod,
      totalPkr: order.totalPkr,
    },
  });

  await Promise.allSettled(
    parsed.data.items.map(async (item) => {
      const product = productById(item.productId);
      if (!product) return;

      await trackUserActivity({
        userId: req.auth!.userId,
        eventType: UserActivityEventType.PRODUCT_PURCHASED,
        productId: product.id,
        brandId: product.brandId,
        topCategory: product.category,
        subCategory: product.subcategory || undefined,
        sourcePage: "checkout",
        gender: product.gender,
        metadata: {
          quantity: item.quantity,
          orderId: order.id,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          unitPricePkr: product.pricePkr,
        },
      });
      
      if (product.category) {
        await incrementProductPurchaseAnalytics(
          product.category as any, 
          product.subcategory as any, 
          product.pricePkr * item.quantity
        ).catch(() => {});
      }
    }),
  );

  await syncCheckoutCart(
    getCartScopeFromUser(req.auth!.userId),
    parsed.data.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
    })),
  );

  return res.status(201).json({
    data: order,
    paymentRedirect,
    paymentSessionId: paymentSession?.id || null,
    paymentRetryExpiresAt: paymentSession?.expiresAt || null,
  });
});

router.patch("/:orderId/status", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      status: brandOrderStatusSchema,
      subOrderId: z.string().trim().min(3).optional(),
      vendorGroupId: z.string().trim().min(3).optional(),
      trackingId: z.string().trim().min(4).max(120).optional(),
      courierName: z.string().trim().max(50).optional(),
      estimatedDelivery: z.coerce.date().optional(),
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

  const order = await prisma.order.findUnique({
    where: { id: String(req.params.orderId) },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { brand: true } },
      subOrders: {
        include: {
          items: true,
          brand: true,
        },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const status = normalizeStatus(parsed.data.status);

  const actingAsPlatformAdmin = req.auth!.role === "ADMIN" || req.auth!.role === "SUPER_ADMIN";
  if (!actingAsPlatformAdmin) {
    const allowedBrands = new Set(await getAllowedBrandIdsForUser(req.auth!.userId, req.auth!.brandId));
    const touchesAnyOwnedBrand = order.subOrders.some((subOrder) => allowedBrands.has(subOrder.brandId));
    if (!touchesAnyOwnedBrand) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  if (!actingAsPlatformAdmin && req.auth!.role !== "BRAND" && req.auth!.role !== "BRAND_ADMIN" && req.auth!.role !== "BRAND_STAFF") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const brandAllowedStatuses = BRAND_FULFILLMENT_STATUSES;
  const adminOnlyStatuses = new Set<OrderStatus>([OrderStatus.SHIPMENT_RETURNED, OrderStatus.RETURNED, OrderStatus.CANCELED]);

  if (!actingAsPlatformAdmin && adminOnlyStatuses.has(status)) {
    return res.status(403).json({ message: "Only admins or system automation can finalize shipment-returned or cancelled vendor groups." });
  }

  if (!actingAsPlatformAdmin && !brandAllowedStatuses.has(status)) {
    return res.status(403).json({ message: "Brand users can only move vendor groups through processing, shipping, delivery, and delivery failure states." });
  }

  const allowedBrands = new Set(await getAllowedBrandIdsForUser(req.auth!.userId, req.auth!.brandId));
  const candidateSubOrders = actingAsPlatformAdmin
    ? order.subOrders
    : order.subOrders.filter((subOrder) => allowedBrands.has(subOrder.brandId));

  const requestedVendorGroupId = parsed.data.vendorGroupId || parsed.data.subOrderId;

  const targetSubOrder = requestedVendorGroupId
    ? candidateSubOrders.find((subOrder) => subOrder.id === requestedVendorGroupId)
    : candidateSubOrders.length === 1
      ? candidateSubOrders[0]
      : null;

  if (!targetSubOrder) {
    return res.status(400).json({ message: "A valid vendorGroupId is required for this status update." });
  }

  if (status === OrderStatus.CONFIRMED) {
    return res.status(409).json({ message: "Orders are confirmed automatically after COD checkout or verified online payment." });
  }

  const trackingId = parsed.data.trackingId ?? targetSubOrder.trackingId;
  const statusChanged = status !== targetSubOrder.status;
  const trackingChanged = trackingId !== targetSubOrder.trackingId;

  if (statusChanged && !orderTransitionMap[targetSubOrder.status].includes(status)) {
    return res.status(409).json({
      message: `Order status cannot move from ${targetSubOrder.status} to ${status}.`,
    });
  }

  if (status === OrderStatus.SHIPPED && !trackingId?.trim()) {
    return res.status(400).json({ message: "Tracking ID is required when setting status to SHIPPED." });
  }

  const normalizedFailureReason = status === OrderStatus.DELIVERY_FAILED ? normalizeDeliveryFailureReasonInput(parsed.data.failureReason) : null;

  if (status === OrderStatus.DELIVERY_FAILED && !normalizedFailureReason) {
    return res.status(400).json({
      message: "failureReason is required when delivery fails.",
      availableReasons: DELIVERY_FAILURE_REASONS,
    });
  }

  if (status === OrderStatus.DELIVERY_FAILED && normalizedFailureReason === "OTHER" && !parsed.data.failureReasonMessage?.trim()) {
    return res.status(400).json({ message: "failureReasonMessage is required when failureReason is OTHER." });
  }

  const failureReasonKey = normalizedFailureReason || "OTHER";

  if (status === OrderStatus.DELIVERY_FAILED && getDeliveryFailurePolicy(failureReasonKey).requiresAddressCorrection && !parsed.data.note?.trim()) {
    return res.status(400).json({ message: "An internal note is required for incorrect address failures so the address can be corrected." });
  }

  const failurePolicy = status === OrderStatus.DELIVERY_FAILED ? getDeliveryFailurePolicy(failureReasonKey) : null;
  const isFinalDeliveryFailure = status === OrderStatus.DELIVERY_FAILED && targetSubOrder.deliveryAttempts >= (failurePolicy?.maxAttempts ?? MAX_DELIVERY_ATTEMPTS);
  
  let effectiveStatus: OrderStatus = status;
  if (status === OrderStatus.DELIVERY_FAILED) {
    if (failureReasonKey === "INCORRECT_ADDRESS") {
      effectiveStatus = OrderStatus.ADDRESS_CORRECTION_REQUIRED;
    } else if (isFinalDeliveryFailure) {
      effectiveStatus = OrderStatus.SHIPMENT_RETURNED;
    }
  }

  const courierChanged = parsed.data.courierName !== undefined && parsed.data.courierName !== targetSubOrder.courierName;
  const estimatedDeliveryChanged = parsed.data.estimatedDelivery !== undefined;

  if (!statusChanged && !trackingChanged && !courierChanged && !estimatedDeliveryChanged && !parsed.data.note && !parsed.data.customerNote && !parsed.data.failureReason && !parsed.data.failureReasonMessage && !parsed.data.nextAttemptDate) {
    return res.json({ data: order });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const estimatedDelivery =
      parsed.data.estimatedDelivery ?? targetSubOrder.estimatedDelivery ?? getAutoEstimatedDelivery(status, now);
    const nextAttemptDate =
      status === OrderStatus.DELIVERY_FAILED && failurePolicy?.retryable && !isFinalDeliveryFailure
        ? calculateNextAttemptDate(failureReasonKey, now)
        : null;

    await tx.subOrder.update({
      where: { id: targetSubOrder.id },
      data: {
        status: effectiveStatus,
        trackingId,
        courierName: parsed.data.courierName ?? targetSubOrder.courierName,
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
        refundProcessedAt: effectiveStatus === OrderStatus.CANCELED && order.paymentMethod !== "COD" ? now : undefined,
      },
    });

    if (effectiveStatus === OrderStatus.CANCELED && targetSubOrder.status !== OrderStatus.CANCELED) {
      await restockOrderItems(
        tx,
        targetSubOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
    }

    await tx.subOrderStatusLog.create({
      data: {
        subOrderId: targetSubOrder.id,
        status: effectiveStatus,
        updatedBy: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: isFinalDeliveryFailure
            ? `Auto-returned after final delivery failure for ${targetSubOrder.brand.name}`
            : parsed.data.failureReason
              ? `Delivery failed: ${describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage)}`
              : parsed.data.note,
          trackingId: trackingChanged ? trackingId : undefined,
          customerNote:
            status === OrderStatus.DELIVERY_FAILED
              ? buildCustomerFailureMessage({
                  failureReason: failureReasonKey,
                  failureReasonMessage: parsed.data.failureReasonMessage,
                  paymentMethod: order.paymentMethod,
                  deliveryAttempt: targetSubOrder.deliveryAttempts,
                  maxAttempts: failurePolicy?.maxAttempts ?? 1,
                  nextAttemptDate,
                  isFinalFailure: isFinalDeliveryFailure,
                })
              : parsed.data.customerNote,
        }),
      },
    });

    await writeStatusHistory(tx, {
      subOrderId: targetSubOrder.id,
      oldStatus: targetSubOrder.status,
      newStatus: effectiveStatus,
      changedByRole: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
      changedById: req.auth!.userId,
      reason: status === OrderStatus.DELIVERY_FAILED ? failureReasonKey : undefined,
      note: parsed.data.note || parsed.data.customerNote || undefined,
    });

    await recordCodRefusalIfNeeded(tx, {
      userId: order.userId,
      paymentMethod: order.paymentMethod,
      failureReason: status === OrderStatus.DELIVERY_FAILED ? failureReasonKey : null,
      now,
    });

    if (effectiveStatus === OrderStatus.SHIPMENT_RETURNED && shouldCreateRefundForPayment(order.paymentMethod)) {
      const existingRefund = await tx.refundRequest.findFirst({
        where: {
          subOrderId: targetSubOrder.id,
          reasonCode: "DELIVERY_FAILURE",
          status: { in: ["PENDING", "APPROVED", "PROCESSING"] },
        },
        select: { id: true },
      });

      if (!existingRefund) {
        const refund = calculateRefundItems(targetSubOrder.items);
        if (refund.amountPkr > 0) {
          await createRefundRecord(tx, {
            orderId: order.id,
            subOrderId: targetSubOrder.id,
            requestedByRole: "SYSTEM",
            reasonCode: "DELIVERY_FAILURE",
            reasonText: describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage),
            method: getRefundMethodForPayment(order.paymentMethod),
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: "Auto-created after shipment returned from delivery failure.",
          });
        }
      }
    }

    const refreshedSubOrders = await tx.subOrder.findMany({
      where: { orderId: order.id },
      select: { status: true, trackingId: true },
    });

    const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((subOrder) => subOrder.status));
    const nextTrackingId =
      refreshedSubOrders.length === 1
        ? refreshedSubOrders[0].trackingId
        : refreshedSubOrders.every((subOrder) => subOrder.trackingId && subOrder.trackingId === refreshedSubOrders[0].trackingId)
          ? refreshedSubOrders[0].trackingId
          : null;

    const allTerminalAfterReturn = refreshedSubOrders.every(
      (subOrder) => subOrder.status === OrderStatus.SHIPMENT_RETURNED || subOrder.status === OrderStatus.CANCELED,
    );
    const nextPaymentStatus =
      nextParentStatus === OrderStatus.DELIVERED && order.paymentMethod === "COD"
        ? PaymentStatus.COMPLETED
        : effectiveStatus === OrderStatus.CANCELED && order.paymentMethod !== "COD" && allTerminalAfterReturn
          ? PaymentStatus.REFUNDED
          : order.paymentStatus;

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: nextParentStatus,
        trackingId: nextTrackingId,
        paymentStatus: nextPaymentStatus,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: nextParentStatus,
        updatedBy: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: isFinalDeliveryFailure
            ? `Vendor group (${targetSubOrder.brand.name}) reached final delivery failure and was auto-returned`
            : parsed.data.note
              ? `Vendor group (${targetSubOrder.brand.name}) update: ${parsed.data.note}`
              : `Vendor group (${targetSubOrder.brand.name}) updated to ${effectiveStatus}`,
          trackingId: trackingChanged ? trackingId : undefined,
          customerNote: parsed.data.customerNote,
        }),
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        items: { include: { product: true, brand: true } },
        subOrders: {
          include: {
            brand: true,
            items: { include: { product: true } },
            statusLogs: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "asc" },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  });

  const parentStatusAfterUpdate = updated.status;

  const customerFacingNote = buildSubOrderUpdateNote(
    effectiveStatus,
    targetSubOrder.brand.name,
    parentStatusAfterUpdate,
    parsed.data.customerNote,
  );

  if (statusChanged) {
    const updatedSubOrder = updated.subOrders.find((so) => so.id === targetSubOrder.id);
    const persistedNextAttemptDate = updatedSubOrder?.nextAttemptDate;

    const failureEventNote = status === OrderStatus.DELIVERY_FAILED
      ? describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage)
      : customerFacingNote;

    if (status === OrderStatus.DELIVERY_FAILED && persistedNextAttemptDate && failureReasonKey !== "INCORRECT_ADDRESS") {
      queueNotificationEvent({
        name: notificationEventNames.orderRetryScheduled,
        orderId: order.id,
        subOrderId: targetSubOrder.id,
        userId: order.userId,
        brandId: targetSubOrder.brandId,
        brandName: targetSubOrder.brand.name,
        changedByRole: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
        note: `Retry scheduled for ${persistedNextAttemptDate.toISOString()}. ${describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage)}`,
        notifyAdmin: true,
      });
    }

    queueNotificationEvent({
      name: resolveOrderEventName(effectiveStatus),
      orderId: order.id,
      subOrderId: targetSubOrder.id,
      userId: order.userId,
      brandId: targetSubOrder.brandId,
      brandName: targetSubOrder.brand.name,
      changedByRole: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
      note: failureEventNote,
      notifyAdmin: true,
    });

    if (isFinalDeliveryFailure) {
      queueNotificationEvent({
        name: notificationEventNames.orderShipmentReturned,
        orderId: order.id,
        subOrderId: targetSubOrder.id,
        userId: order.userId,
        brandId: targetSubOrder.brandId,
        brandName: targetSubOrder.brand.name,
        changedByRole: "SYSTEM",
        note: `Final delivery failure reached for ${describeFailureReason(failureReasonKey, parsed.data.failureReasonMessage)}. Order will be cancelled after the return window.`,
        notifyAdmin: true,
      });
    }
  }

  if (effectiveStatus === OrderStatus.DELIVERED && order.paymentMethod === "COD" && order.paymentStatus !== PaymentStatus.COMPLETED) {
    queueNotificationEvent({
      name: notificationEventNames.paymentSuccess,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: order.paymentMethod,
    });
  }

  if (effectiveStatus === OrderStatus.CANCELED && order.paymentMethod !== "COD") {
    queueNotificationEvent({
      name: notificationEventNames.refundProcessed,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: order.paymentMethod,
      reason: parsed.data.note || parsed.data.failureReason,
    });
  }

  return res.json({ data: updated });
});

router.post("/me/:orderId/cancel", requireAuth, async (req, res) => {
  const payload = z
    .object({
      reasonCode: cancelReasonCodeSchema.optional(),
      customReason: z.string().trim().max(240).optional(),
      note: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (payload.data.reasonCode === "OTHER" && !payload.data.customReason?.trim()) {
    return res.status(400).json({ message: "customReason is required when reasonCode is OTHER." });
  }

  const cancellationReason = composeCancellationReason(
    payload.data.reasonCode,
    payload.data.customReason,
    payload.data.note,
  );

  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { product: true, brand: true } },
      subOrders: { include: { items: true, brand: true } },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const blockedSubOrder = order.subOrders.find((subOrder) => getCancellationMode(subOrder.status) === "BLOCKED" || getCancellationMode(subOrder.status) === "ADMIN_ONLY");
  if (blockedSubOrder) {
    return res.status(409).json({ message: "This order can no longer be cancelled normally. Use the delivery or return flow." });
  }

  const canceled = await prisma.$transaction(async (tx) => {
    const cancellationRequests: Array<{ id: string; subOrderId: string }> = [];
    for (const subOrder of order.subOrders) {
      if (subOrder.status === OrderStatus.CANCELED) continue;

      if (AUTO_CANCELLABLE_STATUSES.has(subOrder.status)) {
        await tx.subOrder.update({
          where: { id: subOrder.id },
          data: { status: OrderStatus.CANCELED },
        });

        await restockOrderItems(
          tx,
          subOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );

        await tx.subOrderStatusLog.create({
          data: {
            subOrderId: subOrder.id,
            status: OrderStatus.CANCELED,
            updatedBy: "USER",
            updatedById: req.auth!.userId,
            note: composeStatusNote(cancellationReason || "Vendor group cancelled by customer"),
          },
        });

        await writeStatusHistory(tx, {
          subOrderId: subOrder.id,
          oldStatus: subOrder.status,
          newStatus: OrderStatus.CANCELED,
          changedByRole: "USER",
          changedById: req.auth!.userId,
          reason: mapCustomerCancellationReasonCode(payload.data.reasonCode),
          note: cancellationReason || "Vendor group cancelled by customer",
        });

        if (shouldCreateRefundForPayment(order.paymentMethod)) {
          const refund = calculateRefundItems(subOrder.items);
          if (refund.amountPkr > 0) {
            await createRefundRecord(tx, {
              orderId: order.id,
              subOrderId: subOrder.id,
              requestedByRole: "USER",
              requestedById: req.auth!.userId,
              reasonCode: "CUSTOMER_CANCELLATION",
              reasonText: cancellationReason,
              method: getRefundMethodForPayment(order.paymentMethod),
              amountPkr: refund.amountPkr,
              items: refund.refundItems,
              note: "Auto-created after customer cancellation.",
            });
          }
        }

        continue;
      }

      if (CANCELLATION_REQUEST_STATUSES.has(subOrder.status)) {
        const existing = await tx.cancellationRequest.findFirst({
          where: {
            subOrderId: subOrder.id,
            status: { in: ["REQUESTED"] },
          },
          select: { id: true, subOrderId: true },
        });

        if (existing) {
          cancellationRequests.push(existing);
          continue;
        }

        const deadlines = getCancellationRequestDeadlines();
        const request = await tx.cancellationRequest.create({
          data: {
            orderId: order.id,
            subOrderId: subOrder.id,
            brandId: subOrder.brandId,
            requestedByRole: "USER",
            requestedById: req.auth!.userId,
            reasonCode: mapCustomerCancellationReasonCode(payload.data.reasonCode),
            reasonText: cancellationReason || null,
            expiresAt: deadlines.expiresAt,
            autoApproveAt: deadlines.autoApproveAt,
          },
          select: { id: true, subOrderId: true },
        });

        await tx.cancellationHistory.create({
          data: {
            cancellationRequestId: request.id,
            action: "CREATED",
            performedByRole: "USER",
            performedById: req.auth!.userId,
            note: cancellationReason || null,
          },
        });

        cancellationRequests.push(request);
      }
    }

    const refreshedSubOrders = await tx.subOrder.findMany({
      where: { orderId: order.id },
      select: { status: true, trackingId: true },
    });

    const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((subOrder) => subOrder.status));

    await tx.order.update({
      where: { id: order.id },
      data: { status: nextParentStatus },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: nextParentStatus,
        updatedBy: "USER",
        updatedById: req.auth!.userId,
        note: composeStatusNote(cancellationReason || "Order cancellation requested by customer"),
      },
    });

    const nextOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: { include: { product: true, brand: true } },
        subOrders: {
          include: {
            brand: true,
            items: { include: { product: true } },
            statusLogs: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "asc" },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    return { ...nextOrder, cancellationRequests };
  });

  queueNotificationEvent({
    name: notificationEventNames.orderCancelled,
    orderId: order.id,
    userId: order.userId,
    changedByRole: "USER",
    note: cancellationReason,
    notifyAdmin: false,
  });

  for (const subOrder of order.subOrders.filter((entry) => AUTO_CANCELLABLE_STATUSES.has(entry.status))) {
    queueNotificationEvent({
      name: notificationEventNames.orderCancelled,
      orderId: order.id,
      subOrderId: subOrder.id,
      userId: order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand?.name,
      changedByRole: "USER",
      note: cancellationReason || `${subOrder.brand?.name || "Brand"} vendor group canceled by customer`,
      notifyAdmin: true,
    });
  }

  for (const subOrder of order.subOrders.filter((entry) => CANCELLATION_REQUEST_STATUSES.has(entry.status))) {
    queueNotificationEvent({
      name: notificationEventNames.cancellationRequestCreated,
      orderId: order.id,
      subOrderId: subOrder.id,
      userId: order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand?.name,
      changedByRole: "USER",
      note: cancellationReason || "Customer requested cancellation.",
      notifyAdmin: true,
    });
  }

  await Promise.allSettled(
    order.items.map(async (item) => {
      if (!item.product) return;

      await trackUserActivity({
        userId: req.auth!.userId,
        eventType: UserActivityEventType.PRODUCT_CANCELLED,
        productId: item.productId,
        brandId: item.product.brandId,
        topCategory: item.product.category,
        subCategory: item.product.subcategory || undefined,
        sourcePage: "order-cancel",
        gender: item.product.gender,
        metadata: {
          orderId: order.id,
          quantity: item.quantity,
          reason: cancellationReason,
        },
      });
    }),
  );

  return res.json({ data: canceled });
});

router.post("/me/:orderId/sub-orders/:subOrderId/cancel", requireAuth, async (req, res) => {
  const payload = z
    .object({
      reasonCode: cancelReasonCodeSchema.optional(),
      customReason: z.string().trim().max(240).optional(),
      note: z.string().trim().max(240).optional(),
      orderItemIds: z.array(z.string()).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (payload.data.reasonCode === "OTHER" && !payload.data.customReason?.trim()) {
    return res.status(400).json({ message: "customReason is required when reasonCode is OTHER." });
  }

  const cancellationReason = composeCancellationReason(
    payload.data.reasonCode,
    payload.data.customReason,
    payload.data.note,
  );

  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { product: true, brand: true } },
      subOrders: {
        include: {
          brand: true,
          items: true,
        },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const targetSubOrder = order.subOrders.find((subOrder) => subOrder.id === String(req.params.subOrderId));
  if (!targetSubOrder) {
    return res.status(404).json({ message: "Vendor group not found" });
  }

  const cancellationMode = getCancellationMode(targetSubOrder.status);
  if (cancellationMode === "BLOCKED" || cancellationMode === "ADMIN_ONLY") {
    return res.status(409).json({ message: "This vendor group can no longer be cancelled normally. Use the delivery or return flow." });
  }

  if (cancellationMode === "TERMINAL") {
    return res.status(409).json({ message: "This vendor group is already cancelled." });
  }

  // All item-level cancellations from customer are treated as requests
  if (cancellationMode === "REQUEST") {
    const request = await prisma.$transaction(async (tx) => {
      const existing = await tx.cancellationRequest.findFirst({
        where: {
          subOrderId: targetSubOrder.id,
          status: { in: ["REQUESTED"] },
        },
        include: { history: { orderBy: { createdAt: "desc" } } },
      });

      if (existing) return existing;

      const deadlines = getCancellationRequestDeadlines();
      const created = await tx.cancellationRequest.create({
        data: {
          orderId: order.id,
          subOrderId: targetSubOrder.id,
          brandId: targetSubOrder.brandId,
          requestedByRole: "USER",
          requestedById: req.auth!.userId,
          reasonCode: mapCustomerCancellationReasonCode(payload.data.reasonCode),
          reasonText: cancellationReason || null,
          orderItemIds: payload.data.orderItemIds,
          expiresAt: deadlines.expiresAt,
          autoApproveAt: deadlines.autoApproveAt,
        },
      });

      await tx.cancellationHistory.create({
        data: {
          cancellationRequestId: created.id,
          action: "CREATED",
          performedByRole: "USER",
          performedById: req.auth!.userId,
          note: cancellationReason || null,
        },
      });

      return tx.cancellationRequest.findUniqueOrThrow({
        where: { id: created.id },
        include: { history: { orderBy: { createdAt: "desc" } } },
      });
    });

    queueNotificationEvent({
      name: notificationEventNames.cancellationRequestCreated,
      orderId: order.id,
      subOrderId: targetSubOrder.id,
      userId: order.userId,
      brandId: targetSubOrder.brandId,
      brandName: targetSubOrder.brand.name,
      changedByRole: "USER",
      note: cancellationReason || "Customer requested cancellation.",
      notifyAdmin: true,
    });

    return res.status(202).json({ data: { ...order, cancellationRequest: request } });
  }

  const canceled = await prisma.$transaction(async (tx) => {
    if (targetSubOrder.status !== OrderStatus.CANCELED) {
      const isPartial = payload.data.orderItemIds && payload.data.orderItemIds.length > 0 && payload.data.orderItemIds.length < targetSubOrder.items.length;
      const cancelledItemIds = isPartial ? payload.data.orderItemIds : targetSubOrder.items.map((i: any) => i.id);
      const itemsToCancel = targetSubOrder.items.filter((i: any) => cancelledItemIds!.includes(i.id));

      if (!isPartial) {
        await tx.subOrder.update({
          where: { id: targetSubOrder.id },
          data: { status: OrderStatus.CANCELED },
        });
      }

      await restockOrderItems(
        tx,
        itemsToCancel.map((item: any) => ({ productId: item.productId, quantity: item.quantity })),
      );

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: targetSubOrder.id,
          status: isPartial ? targetSubOrder.status : OrderStatus.CANCELED,
          updatedBy: "USER",
          updatedById: req.auth!.userId,
          note: isPartial
            ? `CANCELLED_ITEMS:${cancelledItemIds!.join(",")} | Partial item cancellation by customer: ${cancellationReason || "Customer cancelled specific items"}`
            : composeStatusNote(cancellationReason || "Vendor group cancelled by customer"),
        },
      });

      if (!isPartial) {
        await writeStatusHistory(tx, {
          subOrderId: targetSubOrder.id,
          oldStatus: targetSubOrder.status,
          newStatus: OrderStatus.CANCELED,
          changedByRole: "USER",
          changedById: req.auth!.userId,
          reason: mapCustomerCancellationReasonCode(payload.data.reasonCode),
          note: cancellationReason || "Vendor group cancelled by customer",
        });
      }

      if (shouldCreateRefundForPayment(order.paymentMethod)) {
        const refund = calculateRefundItems(itemsToCancel as any);
        if (refund.amountPkr > 0) {
          const refundRec = await createRefundRecord(tx, {
            orderId: order.id,
            subOrderId: targetSubOrder.id,
            requestedByRole: "USER",
            requestedById: req.auth!.userId,
            reasonCode: "CUSTOMER_CANCELLATION",
            reasonText: cancellationReason,
            method: getRefundMethodForPayment(order.paymentMethod),
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: "Auto-approved customer cancellation refund.",
          });

          if (refundRec && order.paymentStatus === "COMPLETED") {
            await tx.refundRequest.update({
              where: { id: refundRec.id },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
              },
            });

            await tx.refundStatusLog.create({
              data: {
                refundRequestId: refundRec.id,
                status: "COMPLETED",
                updatedBy: "SYSTEM",
                note: "Auto-approved customer cancellation refund.",
              },
            });

            await tx.refundHistory.create({
              data: {
                refundRequestId: refundRec.id,
                oldStatus: "PENDING",
                newStatus: "COMPLETED",
                performedByRole: "SYSTEM",
                note: "Auto-approved customer cancellation refund.",
              },
            });

            await tx.subOrder.update({
              where: { id: targetSubOrder.id },
              data: { refundProcessedAt: new Date() },
            });

            await creditWallet(tx, {
              userId: order.userId,
              amountPkr: refund.amountPkr,
              sourceType: "REFUND",
              note: "Auto-approved customer cancellation refund.",
              orderId: order.id,
              refundRequestId: refundRec.id,
            });
          }
        }
      }
    }

    const refreshedSubOrders = await tx.subOrder.findMany({
      where: { orderId: order.id },
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
      where: { id: order.id },
      data: {
        status: nextParentStatus,
        trackingId: nextTrackingId,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: nextParentStatus,
        updatedBy: "USER",
        updatedById: req.auth!.userId,
        note: composeStatusNote(cancellationReason || `Vendor group (${targetSubOrder.brand.name}) cancelled by customer`),
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: { include: { product: true, brand: true } },
        subOrders: {
          include: {
            brand: true,
            items: { include: { product: true } },
            statusLogs: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "asc" },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });
  });

  queueNotificationEvent({
    name: notificationEventNames.orderCancelled,
    orderId: order.id,
    subOrderId: targetSubOrder.id,
    userId: order.userId,
    brandId: targetSubOrder.brandId,
    brandName: targetSubOrder.brand.name,
    changedByRole: "USER",
    note: cancellationReason || `${targetSubOrder.brand.name} vendor group canceled by customer`,
    notifyAdmin: true,
  });

  await Promise.allSettled(
    order.items
      .filter((item) => item.subOrderId === targetSubOrder.id)
      .map(async (item) => {
        if (!item.product) return;

        await trackUserActivity({
          userId: req.auth!.userId,
          eventType: UserActivityEventType.PRODUCT_CANCELLED,
          productId: item.productId,
          brandId: item.product.brandId,
          topCategory: item.product.category,
          subCategory: item.product.subcategory || undefined,
          sourcePage: "order-cancel",
          gender: item.product.gender,
          metadata: {
            orderId: order.id,
            subOrderId: targetSubOrder.id,
            quantity: item.quantity,
            reason: cancellationReason,
          },
        });
      }),
  );

  return res.json({ data: canceled });
});

router.post("/me/:orderId/sub-orders/:subOrderId/return", requireAuth, async (req, res) => {
  const payload = z
    .object({
      reasonCode: returnReasonCodeSchema,
      reasonText: z.string().trim().max(500).optional(),
      customerNote: z.string().trim().max(500).optional(),
      evidenceImageUrls: z.array(z.string().trim().url().max(500)).max(5).optional(),
      preferredResolution: z
        .enum([
          "REFUND",
          "EXCHANGE_SIZE",
          "EXCHANGE_COLOR",
          "EXCHANGE_DAMAGED_REPLACEMENT",
          "EXCHANGE_WRONG_ITEM_REPLACEMENT",
          "EXCHANGE_OTHER",
          "STORE_CREDIT",
        ])
        .optional(),
      orderItemIds: z.array(z.string().trim().min(3)).min(1).optional(),
      requestedVariantSummary: z.string().trim().max(500).optional(),
      requestedExchangeType: z.enum(["SIZE", "COLOR", "DAMAGED_REPLACEMENT", "WRONG_ITEM_REPLACEMENT", "OTHER"]).optional(),
      requestedReplacementVariantId: z.string().trim().min(3).max(120).optional(),
      requestedReplacementSize: z.string().trim().max(80).optional(),
      requestedReplacementColor: z.string().trim().max(80).optional(),
      requestType: z.enum(["RETURN", "EXCHANGE"]).optional(),
      customerRefundPreference: z.string().trim().max(80).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (payload.data.reasonCode === "OTHER" && !payload.data.reasonText?.trim()) {
    return res.status(400).json({ message: "reasonText is required when reasonCode is OTHER." });
  }

  const order = await prisma.order.findFirst({
    where: { id: String(req.params.orderId), userId: req.auth!.userId },
    include: {
      subOrders: {
        include: {
          brand: true,
          statusLogs: { orderBy: { createdAt: "desc" } },
          items: {
            include: {
              product: { include: { shipping: true } },
            },
          },
        },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });
  const targetSubOrder = order.subOrders.find((entry) => entry.id === String(req.params.subOrderId));
  if (!targetSubOrder) return res.status(404).json({ message: "Vendor group not found" });
  if (targetSubOrder.status !== OrderStatus.DELIVERED) {
    return res.status(409).json({ message: "Return is only available after delivery." });
  }

  const evidenceRequiredReasons = new Set<z.infer<typeof returnReasonCodeSchema>>([
    "DAMAGED_ITEM",
    "DEFECTIVE_PRODUCT",
    "WRONG_ITEM",
    "WRONG_SIZE",
    "WRONG_COLOR",
  ]);
  if (evidenceRequiredReasons.has(payload.data.reasonCode) && !payload.data.evidenceImageUrls?.length) {
    return res.status(400).json({ message: "Evidence images are required for damaged, defective, or wrong item claims." });
  }

  const selectedItems = payload.data.orderItemIds?.length
    ? targetSubOrder.items.filter((item) => payload.data.orderItemIds!.includes(item.id))
    : targetSubOrder.items;

  if (!selectedItems.length) {
    return res.status(400).json({ message: "No valid order items were selected for this request." });
  }

  if (payload.data.orderItemIds?.length && selectedItems.length !== payload.data.orderItemIds.length) {
    return res.status(400).json({ message: "One or more selected items are not part of this vendor group." });
  }

  const nonReturnableItem = selectedItems.find((item) => {
    const product = item.product;
    if (product.shipping?.returnAvailable === false) return true;
    return isDefaultNonReturnableProduct(product);
  });
  if (nonReturnableItem) {
    return res.status(409).json({ message: "One or more selected products are non-returnable." });
  }

  const itemReturnWindows = selectedItems.map((item) => item.product.shipping?.returnWindowDays).filter((value): value is number => typeof value === "number" && value > 0);
  const returnWindowDays = itemReturnWindows.length ? Math.min(...itemReturnWindows) : targetSubOrder.brand.returnWindowDays || DEFAULT_RETURN_WINDOW_DAYS;
  const returnDeadline = addDays(getDeliveredAt(targetSubOrder), returnWindowDays);
  if (Date.now() > returnDeadline.getTime()) {
    return res.status(409).json({ message: "Return window has expired for one or more selected items." });
  }

  const db = prisma as any;
  const selectedOrderItemIds = selectedItems.map((item) => item.id);
  const existingOpenReturns = await db.returnRequest.findMany({
    where: {
      orderId: order.id,
      subOrderId: targetSubOrder.id,
      status: { notIn: ["REJECTED", "ADMIN_REJECTED", "COMPLETED", "EXCHANGE_COMPLETED"] },
    },
    select: { id: true, status: true, orderItemIds: true },
  });
  const existingOpenReturn = existingOpenReturns.find((request: { orderItemIds?: string[] | null }) => {
    const requestItemIds = request.orderItemIds?.length ? request.orderItemIds : targetSubOrder.items.map((item) => item.id);
    return requestItemIds.some((itemId: string) => selectedOrderItemIds.includes(itemId));
  });
  if (existingOpenReturn) {
    return res.status(409).json({ message: "A return or exchange request is already active for one or more selected items." });
  }

  const requestType = inferReturnRequestType({
    requestType: payload.data.requestType,
    preferredResolution: payload.data.preferredResolution,
  });
  const preferredResolution =
    requestType === "EXCHANGE"
      ? payload.data.preferredResolution?.startsWith("EXCHANGE")
        ? payload.data.preferredResolution
        : deriveExchangeResolutionForReason(payload.data.reasonCode)
      : payload.data.preferredResolution?.startsWith("EXCHANGE")
        ? "REFUND"
        : payload.data.preferredResolution || "REFUND";

  if (requestType === "EXCHANGE" && !payload.data.requestedVariantSummary?.trim() && !payload.data.requestedExchangeType) {
    return res.status(400).json({ message: "Exchange requests must include the requested replacement summary or exchange type." });
  }

  const created = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const selectedOrderItemIds = payload.data.orderItemIds?.length
      ? targetSubOrder.items.filter((item) => payload.data.orderItemIds!.includes(item.id)).map((item) => item.id)
      : targetSubOrder.items.map((item) => item.id);
    const returnRequest = await dbTx.returnRequest.create({
      data: {
        orderId: order.id,
        subOrderId: targetSubOrder.id,
        userId: req.auth!.userId,
        orderItemIds: selectedOrderItemIds,
        requestType,
        reasonCode: payload.data.reasonCode,
        reasonText: payload.data.reasonText?.trim() || null,
        customerNote: payload.data.customerNote?.trim() || payload.data.reasonText?.trim() || null,
        evidenceImageUrls: payload.data.evidenceImageUrls || [],
        preferredResolution,
        requestedExchangeType: payload.data.requestedExchangeType || deriveExchangeType(preferredResolution) || null,
        requestedVariantSummary: payload.data.requestedVariantSummary?.trim() || null,
        requestedReplacementVariantId: payload.data.requestedReplacementVariantId?.trim() || null,
        requestedReplacementSize: payload.data.requestedReplacementSize?.trim() || null,
        requestedReplacementColor: payload.data.requestedReplacementColor?.trim() || null,
        customerRefundPreference: payload.data.customerRefundPreference?.trim() || null,
        status: "REQUESTED",
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: returnRequest.id,
        status: "REQUESTED",
        updatedBy: "SYSTEM",
        updatedById: req.auth!.userId,
        note: payload.data.reasonText?.trim() || payload.data.reasonCode,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: returnRequest.id,
        oldStatus: null,
        newStatus: "REQUESTED",
        performedByRole: "USER",
        performedById: req.auth!.userId,
        note: payload.data.customerNote?.trim() || payload.data.reasonText?.trim() || payload.data.reasonCode,
      },
    });

    return dbTx.returnRequest.findUniqueOrThrow({
      where: { id: returnRequest.id },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, paymentStatus: true, totalPkr: true, createdAt: true } },
        subOrder: {
          include: {
            brand: { select: { id: true, name: true } },
            items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
          },
        },
        statusLogs: { orderBy: { createdAt: "asc" } },
        history: { orderBy: { createdAt: "asc" } },
      },
    });
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: order.id,
    subOrderId: targetSubOrder.id,
    userId: order.userId,
    brandId: targetSubOrder.brandId,
    brandName: targetSubOrder.brand.name,
    changedByRole: "USER",
    note: `${requestType === "EXCHANGE" ? "Exchange" : "Return"} requested (${payload.data.reasonCode})${payload.data.reasonText ? `: ${payload.data.reasonText}` : ""}`,
    notifyAdmin: true,
  });

  const returnedItems = await prisma.orderItem.findMany({
    where: { id: { in: selectedOrderItemIds } },
    include: { product: true },
  });

  await Promise.allSettled(
    returnedItems.map(async (item) => {
      if (!item.product) return;

      await trackUserActivity({
        userId: req.auth!.userId,
        eventType: UserActivityEventType.PRODUCT_RETURNED,
        productId: item.productId,
        brandId: item.product.brandId,
        topCategory: item.product.category,
        subCategory: item.product.subcategory || undefined,
        sourcePage: "order-return",
        gender: item.product.gender,
        metadata: {
          orderId: order.id,
          subOrderId: targetSubOrder.id,
          quantity: item.quantity,
          reasonCode: payload.data.reasonCode,
          reasonText: payload.data.reasonText?.trim(),
          returnRequestId: created.id,
        },
      });
    }),
  );

  return res.status(201).json({ data: normalizeReturnRequestForApi(created) });
});

router.patch("/me/:orderId/sub-orders/:subOrderId/return-requests/:returnRequestId/evidence", requireAuth, async (req, res) => {
  const payload = z
    .object({
      evidenceImageUrls: z.array(z.string().trim().url().max(500)).min(1).max(5),
      customerNote: z.string().trim().max(500).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const db = prisma as any;
  const request = await db.returnRequest.findFirst({
    where: {
      id: String(req.params.returnRequestId),
      orderId: String(req.params.orderId),
      subOrderId: String(req.params.subOrderId),
      userId: req.auth!.userId,
    },
    include: {
      order: { select: { id: true, userId: true, paymentMethod: true, paymentStatus: true, totalPkr: true, createdAt: true } },
      subOrder: {
        include: {
          brand: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
        },
      },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!request) {
    return res.status(404).json({ message: "Return request not found" });
  }

  if (request.status !== "NEED_MORE_EVIDENCE") {
    return res.status(409).json({ message: "Additional evidence can be uploaded only when more evidence is requested." });
  }

  const mergedEvidence = Array.from(new Set([...(request.evidenceImageUrls || []), ...payload.data.evidenceImageUrls]));
  const note = payload.data.customerNote?.trim() || "Customer uploaded additional evidence.";

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: "BRAND_REVIEWING",
        evidenceImageUrls: mergedEvidence,
        customerNote: payload.data.customerNote?.trim() || request.customerNote,
      },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true, paymentStatus: true, totalPkr: true, createdAt: true } },
        subOrder: {
          include: {
            brand: { select: { id: true, name: true } },
            items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
          },
        },
        statusLogs: { orderBy: { createdAt: "asc" } },
        history: { orderBy: { createdAt: "asc" } },
        refundRequests: { orderBy: { createdAt: "desc" } },
      },
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: request.id,
        status: "BRAND_REVIEWING",
        updatedBy: "USER",
        updatedById: req.auth!.userId,
        note,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: request.id,
        oldStatus: "NEED_MORE_EVIDENCE",
        newStatus: "BRAND_REVIEWING",
        performedByRole: "USER",
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
    brandName: request.subOrder.brand.name,
    changedByRole: "USER",
    note,
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.get("/me/:orderId/sub-orders/:subOrderId/cancellation-requests", requireAuth, async (req, res) => {
  const requests = await prisma.cancellationRequest.findMany({
    where: {
      orderId: String(req.params.orderId),
      subOrderId: String(req.params.subOrderId),
      order: { userId: req.auth!.userId },
    },
    include: {
      order: { select: { id: true, userId: true, paymentMethod: true, paymentStatus: true, createdAt: true } },
      subOrder: {
        include: {
          brand: { select: { id: true, name: true } },
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
      history: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: requests });
});

router.get("/me/:orderId/sub-orders/:subOrderId/return-requests", requireAuth, async (req, res) => {
  const db = prisma as any;
  const requests = await db.returnRequest.findMany({
    where: {
      orderId: String(req.params.orderId),
      subOrderId: String(req.params.subOrderId),
      userId: req.auth!.userId,
    },
    include: {
      order: { select: { id: true, userId: true, paymentMethod: true, paymentStatus: true, totalPkr: true, createdAt: true } },
      subOrder: {
        include: {
          brand: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
        },
      },
      statusLogs: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
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
  });

  return res.json({ data: requests.map((request: any) => normalizeReturnRequestForApi(request)) });
});

router.get("/me/:orderId/sub-orders/:subOrderId/refund-requests", requireAuth, async (req, res) => {
  const db = prisma as any;
  const requests = await db.refundRequest.findMany({
    where: {
      orderId: String(req.params.orderId),
      subOrderId: String(req.params.subOrderId),
      order: { userId: req.auth!.userId },
    },
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
      walletTransactions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: requests });
});

router.post("/me/:orderId/reorder", requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      items: true,
      subOrders: {
        select: { status: true },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const hasOnlyCompletedOrCanceledGroups = order.subOrders.every(
    (subOrder) => subOrder.status === OrderStatus.DELIVERED || subOrder.status === OrderStatus.CANCELED || subOrder.status === OrderStatus.RETURNED,
  );

  if (!hasOnlyCompletedOrCanceledGroups) {
    return res.status(409).json({ message: "Reorder is available only when all vendor groups are delivered or canceled." });
  }

  const productIds = Array.from(new Set(order.items.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
      approvalStatus: "APPROVED",
    },
    select: { id: true },
  });

  const activeProductIds = new Set(products.map((item) => item.id));
  const reorderItems = order.items.filter((item) => activeProductIds.has(item.productId));

  if (!reorderItems.length) {
    return res.status(409).json({ message: "None of the items in this order are currently available for reorder." });
  }

  const scope = getCartScopeFromUser(req.auth!.userId);
  for (const item of reorderItems) {
    const variantAwareItem = item as unknown as { selectedColor?: string | null; selectedSize?: string | null };
    const added = await addCartItem(scope, {
      productId: item.productId,
      quantity: item.quantity,
      selectedColor: variantAwareItem.selectedColor || undefined,
      selectedSize: variantAwareItem.selectedSize || undefined,
    });

    if (added.error) {
      return res.status(added.error.status).json(added.error);
    }
  }

  const cart = await getCart(scope);

  return res.json({ data: cart });
});

router.post("/me/:orderId/sub-orders/:subOrderId/reorder", requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      subOrders: {
        where: { id: String(req.params.subOrderId) },
        include: {
          items: true,
        },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const targetSubOrder = order.subOrders[0];
  if (!targetSubOrder) {
    return res.status(404).json({ message: "Vendor group not found" });
  }

  if (!["DELIVERED", "CANCELED", "RETURNED"].includes(targetSubOrder.status)) {
    return res.status(409).json({ message: "Reorder is available only for delivered, returned, or canceled vendor groups." });
  }

  const productIds = Array.from(new Set(targetSubOrder.items.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
      approvalStatus: "APPROVED",
    },
    select: { id: true },
  });

  const activeProductIds = new Set(products.map((item) => item.id));
  const reorderItems = targetSubOrder.items.filter((item) => activeProductIds.has(item.productId));

  if (!reorderItems.length) {
    return res.status(409).json({ message: "None of the items in this vendor group are currently available for reorder." });
  }

  const scope = getCartScopeFromUser(req.auth!.userId);
  for (const item of reorderItems) {
    const variantAwareItem = item as unknown as { selectedColor?: string | null; selectedSize?: string | null };
    const added = await addCartItem(scope, {
      productId: item.productId,
      quantity: item.quantity,
      selectedColor: variantAwareItem.selectedColor || undefined,
      selectedSize: variantAwareItem.selectedSize || undefined,
    });

    if (added.error) {
      return res.status(added.error.status).json(added.error);
    }
  }

  const cart = await getCart(scope);

  return res.json({ data: cart });
});

router.patch("/me/:orderId/address", requireAuth, async (req, res) => {
  const schema = z.object({
    deliveryAddress: z.string().trim().min(10).max(500),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
  }

  const orderId = String(req.params.orderId);
  const userId = req.auth!.userId;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { subOrders: { include: { brand: true } } },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const updatedOrder = await prisma.$transaction(async (tx) => {
    // Update the order's delivery address
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { deliveryAddress: parsed.data.deliveryAddress },
    });

    // Find sub-orders that require address correction
    const subOrdersToUpdate = order.subOrders.filter(
      (so) => so.status === OrderStatus.ADDRESS_CORRECTION_REQUIRED
    );

    for (const subOrder of subOrdersToUpdate) {
      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: { status: OrderStatus.READY_FOR_REDELIVERY },
      });

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: subOrder.id,
          status: OrderStatus.READY_FOR_REDELIVERY,
          updatedBy: "SYSTEM",
          note: "Address updated by customer. Ready for re-delivery.",
        },
      });

      // Notify the brand
      queueNotificationEvent({
        name: notificationEventNames.orderAddressUpdated,
        orderId: order.id,
        subOrderId: subOrder.id,
        userId: order.userId,
        brandId: subOrder.brandId,
        brandName: subOrder.brand.name,
        changedByRole: "USER",
        note: `Customer has updated the delivery address for Order ${order.id}. New address: ${parsed.data.deliveryAddress}`,
        notifyAdmin: true,
      });
    }

    if (subOrdersToUpdate.length > 0) {
      // Update parent order status if needed
      const refreshedSubOrders = await tx.subOrder.findMany({
        where: { orderId: order.id },
        select: { status: true },
      });
      const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((so) => so.status));
      await tx.order.update({
        where: { id: order.id },
        data: { status: nextParentStatus },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: nextParentStatus,
          updatedBy: "SYSTEM",
          note: "Delivery address updated by customer. Sub-orders moved to Ready for Re-delivery.",
        },
      });
    }

    return updated;
  });

  return res.json({ data: updatedOrder });
});

router.get("/me", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.auth!.userId },
    include: {
      items: { include: { product: true, brand: true } },
      subOrders: {
        include: {
          brand: true,
          items: { include: { product: true } },
          statusLogs: { orderBy: { createdAt: "desc" } },
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
            orderBy: { createdAt: "desc" },
          },
          cancellationRequests: true,
        },
        orderBy: { createdAt: "asc" },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ordersWithPaymentRetry = await Promise.all(orders.map((order) => attachPaymentRetryMetadata(order)));

  return res.json({
    data: ordersWithPaymentRetry.map((order) => ({
      ...order,
      statusLogs: order.statusLogs.map((log) => ({
        ...log,
        note: extractCustomerVisibleNote(log.note) || (log.updatedBy === "SYSTEM" ? log.note : null),
      })),
    })),
  });
});

router.get("/me/:orderId", requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { product: { include: { brand: true } }, brand: true } },
      subOrders: {
        include: {
          brand: true,
          items: { include: { product: true } },
          statusLogs: { orderBy: { createdAt: "desc" } },
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
            orderBy: { createdAt: "desc" },
          },
          cancellationRequests: true,
        },
        orderBy: { createdAt: "asc" },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });
  const orderWithPaymentRetry = await attachPaymentRetryMetadata(order);

  return res.json({
    data: {
      ...orderWithPaymentRetry,
      statusLogs: orderWithPaymentRetry.statusLogs.map((log) => ({
        ...log,
        note: extractCustomerVisibleNote(log.note) || (log.updatedBy === "SYSTEM" ? log.note : null),
      })),
    },
  });
});

export default router;
