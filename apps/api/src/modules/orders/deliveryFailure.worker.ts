import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import {
  buildBrandFailureMessage,
  buildCustomerFailureMessage,
  describeFailureReason,
  getDeliveryFailurePolicy,
  normalizeDeliveryFailureReasonInput,
  type DeliveryFailureReasonKey,
} from "./deliveryFailure.service.js";

type WorkerState = {
  running: boolean;
  timer: NodeJS.Timeout | null;
  activeJobs: number;
  processed: number;
  reminders: number;
  retries: number;
  returned: number;
  cancelled: number;
  failed: number;
  startedAt: number | null;
};

const state: WorkerState = {
  running: false,
  timer: null,
  activeJobs: 0,
  processed: 0,
  reminders: 0,
  retries: 0,
  returned: 0,
  cancelled: 0,
  failed: 0,
  startedAt: null,
};

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
  if (subOrderStatuses.some((status) => status === OrderStatus.PROCESSING)) return OrderStatus.PROCESSING;
  if (subOrderStatuses.every((status) => status === OrderStatus.CONFIRMED)) return OrderStatus.CONFIRMED;
  return OrderStatus.PENDING;
}

function getAgeHours(from: Date, to = new Date()) {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000);
}

async function refreshParentOrder(tx: Prisma.TransactionClient, orderId: string, changedBy: "SYSTEM" | "ADMIN" | "BRAND" = "SYSTEM") {
  const refreshed = await tx.subOrder.findMany({
    where: { orderId },
    select: { status: true, trackingId: true },
  });

  const nextStatus = deriveParentOrderStatus(refreshed.map((subOrder) => subOrder.status));
  const nextTrackingId =
    refreshed.length === 1
      ? refreshed[0].trackingId
      : refreshed.every((subOrder) => subOrder.trackingId && subOrder.trackingId === refreshed[0].trackingId)
        ? refreshed[0].trackingId
        : null;

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      trackingId: nextTrackingId,
    },
  });

  await tx.orderStatusLog.create({
    data: {
      orderId,
      status: nextStatus,
      updatedBy: changedBy,
      note: `Parent order auto-refreshed to ${nextStatus} by delivery failure automation.`,
    },
  });
}

async function autoRetrySubOrder(subOrder: {
  id: string;
  orderId: string;
  brandId: string;
  status: OrderStatus;
  trackingId: string | null;
  deliveryAttempts: number;
  failureReason: string | null;
  failureReasonMessage: string | null;
  nextAttemptDate: Date | null;
  deliveryFailedAt: Date | null;
  brandReminderSentAt: Date | null;
  finalDeliveryFailureAt: Date | null;
  lastAttemptAt: Date | null;
  order: { userId: string; paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA" };
  brand: { name: string };
}) {
  const reasonKey = normalizeDeliveryFailureReasonInput(subOrder.failureReason) ?? "OTHER";
  const policy = getDeliveryFailurePolicy(reasonKey);
  const now = new Date();

  if (subOrder.status !== OrderStatus.DELIVERY_FAILED) return false;

  if (policy.retryable && subOrder.nextAttemptDate && subOrder.nextAttemptDate <= now && subOrder.deliveryAttempts < policy.maxAttempts) {
    const attemptNumber = subOrder.deliveryAttempts + 1;

    await prisma.$transaction(async (tx) => {
      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: {
          status: OrderStatus.OUT_FOR_DELIVERY,
          deliveryAttempts: { increment: 1 },
          lastAttemptAt: now,
          nextAttemptDate: null,
          deliveryFailedAt: null,
          brandReminderSentAt: null,
        },
      });

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: subOrder.id,
          status: OrderStatus.OUT_FOR_DELIVERY,
          updatedBy: "SYSTEM",
          note: `Automatic retry scheduled for ${describeFailureReason(reasonKey, subOrder.failureReasonMessage)} (attempt ${attemptNumber} of ${policy.maxAttempts}).`,
        },
      });

      await refreshParentOrder(tx, subOrder.orderId, "SYSTEM");
    });

    const customerMessage = buildCustomerFailureMessage({
      failureReason: reasonKey,
      failureReasonMessage: subOrder.failureReasonMessage,
      paymentMethod: subOrder.order.paymentMethod,
      deliveryAttempt: subOrder.deliveryAttempts + 1,
      maxAttempts: policy.maxAttempts,
      nextAttemptDate: null,
      isFinalFailure: false,
    });

    const brandMessage = buildBrandFailureMessage({
      failureReason: reasonKey,
      failureReasonMessage: subOrder.failureReasonMessage,
      paymentMethod: subOrder.order.paymentMethod,
      deliveryAttempt: subOrder.deliveryAttempts + 1,
      maxAttempts: policy.maxAttempts,
      nextAttemptDate: null,
      isFinalFailure: false,
    });

    queueNotificationEvent({
      name: notificationEventNames.orderRetryScheduled,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "SYSTEM",
      note: `${customerMessage} ${brandMessage}`,
      notifyAdmin: true,
    });

    state.retries += 1;
    return true;
  }

  return false;
}

async function processFailedSubOrder(subOrder: {
  id: string;
  orderId: string;
  brandId: string;
  status: OrderStatus;
  trackingId: string | null;
  deliveryAttempts: number;
  failureReason: string | null;
  failureReasonMessage: string | null;
  nextAttemptDate: Date | null;
  deliveryFailedAt: Date | null;
  brandReminderSentAt: Date | null;
  finalDeliveryFailureAt: Date | null;
  lastAttemptAt: Date | null;
  refundProcessedAt: Date | null;
  updatedAt: Date;
  order: { userId: string; paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA"; paymentStatus: PaymentStatus };
  brand: { name: string };
}) {
  const reasonKey = normalizeDeliveryFailureReasonInput(subOrder.failureReason) ?? "OTHER";
  const policy = getDeliveryFailurePolicy(reasonKey);
  const failureStartedAt = subOrder.deliveryFailedAt ?? subOrder.updatedAt;
  const now = new Date();
  const ageHours = getAgeHours(failureStartedAt, now);

  const autoRetried = await autoRetrySubOrder(subOrder);
  if (autoRetried) return;

  const isCorrectionRequired = subOrder.status === OrderStatus.ADDRESS_CORRECTION_REQUIRED;
  const isReadyForRedelivery = subOrder.status === OrderStatus.READY_FOR_REDELIVERY;
  const isDeliveryFailed = subOrder.status === OrderStatus.DELIVERY_FAILED;

  if ((isDeliveryFailed || isCorrectionRequired || isReadyForRedelivery) && ageHours >= 6 && ageHours < 24 && !subOrder.brandReminderSentAt) {
    await prisma.subOrder.update({
      where: { id: subOrder.id },
      data: { brandReminderSentAt: now },
    });

    queueNotificationEvent({
      name: notificationEventNames.orderDeliveryFailed,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "SYSTEM",
      note: `Reminder: delivery remains failed for ${describeFailureReason(reasonKey, subOrder.failureReasonMessage)}. ${buildBrandFailureMessage({
        failureReason: reasonKey,
        failureReasonMessage: subOrder.failureReasonMessage,
        paymentMethod: subOrder.order.paymentMethod,
        deliveryAttempt: subOrder.deliveryAttempts,
        maxAttempts: policy.maxAttempts,
        nextAttemptDate: subOrder.nextAttemptDate,
        isFinalFailure: false,
      })}`,
      notifyAdmin: true,
    });

    state.reminders += 1;
    return;
  }

  if ((isDeliveryFailed || isCorrectionRequired || isReadyForRedelivery) && ageHours >= 24) {
    await prisma.$transaction(async (tx) => {
      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: {
          status: OrderStatus.RETURNED,
          finalDeliveryFailureAt: now,
          nextAttemptDate: null,
          brandReminderSentAt: null,
        },
      });

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: subOrder.id,
          status: OrderStatus.RETURNED,
          updatedBy: "SYSTEM",
          note: `Auto-returned after delivery failure (${describeFailureReason(reasonKey, subOrder.failureReasonMessage)}).`,
        },
      });

      await refreshParentOrder(tx, subOrder.orderId, "SYSTEM");
    });

    queueNotificationEvent({
      name: notificationEventNames.orderReturned,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "SYSTEM",
      note: buildCustomerFailureMessage({
        failureReason: reasonKey,
        failureReasonMessage: subOrder.failureReasonMessage,
        paymentMethod: subOrder.order.paymentMethod,
        deliveryAttempt: subOrder.deliveryAttempts,
        maxAttempts: policy.maxAttempts,
        nextAttemptDate: null,
        isFinalFailure: true,
      }),
      notifyAdmin: true,
    });

    if (subOrder.order.paymentMethod !== "COD") {
      queueNotificationEvent({
        name: notificationEventNames.refundProcessed,
        orderId: subOrder.orderId,
        userId: subOrder.order.userId,
        paymentMethod: subOrder.order.paymentMethod,
        reason: describeFailureReason(reasonKey, subOrder.failureReasonMessage),
      });
    }

    state.returned += 1;
    return;
  }

  if (subOrder.status === OrderStatus.RETURNED) {
    const returnStartedAt = subOrder.finalDeliveryFailureAt ?? subOrder.deliveryFailedAt ?? subOrder.updatedAt;
    if (getAgeHours(returnStartedAt, now) < 48) return;

    await prisma.$transaction(async (tx) => {
      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: {
          status: OrderStatus.CANCELED,
          refundProcessedAt: subOrder.order.paymentMethod === "COD" ? null : now,
        },
      });

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: subOrder.id,
          status: OrderStatus.CANCELED,
          updatedBy: "SYSTEM",
          note:
            subOrder.order.paymentMethod === "COD"
              ? `Auto-cancelled after return window expired for ${describeFailureReason(reasonKey, subOrder.failureReasonMessage)}.`
              : `Auto-cancelled after return window expired and refund workflow completed for ${describeFailureReason(reasonKey, subOrder.failureReasonMessage)}.`,
        },
      });

      await refreshParentOrder(tx, subOrder.orderId, "SYSTEM");

      if (subOrder.order.paymentMethod !== "COD") {
        await tx.order.update({
          where: { id: subOrder.orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED },
        });
      }
    });

    queueNotificationEvent({
      name: notificationEventNames.orderCancelled,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "SYSTEM",
      note: buildCustomerFailureMessage({
        failureReason: reasonKey,
        failureReasonMessage: subOrder.failureReasonMessage,
        paymentMethod: subOrder.order.paymentMethod,
        deliveryAttempt: subOrder.deliveryAttempts,
        maxAttempts: policy.maxAttempts,
        nextAttemptDate: null,
        isFinalFailure: true,
      }),
      notifyAdmin: true,
    });

    if (subOrder.order.paymentMethod !== "COD") {
      queueNotificationEvent({
        name: notificationEventNames.refundProcessed,
        orderId: subOrder.orderId,
        userId: subOrder.order.userId,
        paymentMethod: subOrder.order.paymentMethod,
        reason: describeFailureReason(reasonKey, subOrder.failureReasonMessage),
      });
    }

    state.cancelled += 1;
  }
}

async function tick() {
  if (!state.running) return;

  state.activeJobs += 1;
  try {
    const subOrders = await prisma.subOrder.findMany({
      where: {
        OR: [
          { status: OrderStatus.DELIVERY_FAILED },
          { status: OrderStatus.ADDRESS_CORRECTION_REQUIRED },
          { status: OrderStatus.READY_FOR_REDELIVERY },
          { status: OrderStatus.RETURNED },
        ],
      },
      include: {
        order: {
          select: {
            userId: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });

    for (const subOrder of subOrders) {
      await processFailedSubOrder(subOrder);
      state.processed += 1;
    }
  } catch (error) {
    state.failed += 1;
    console.error("[delivery-failure] worker tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    state.activeJobs = Math.max(state.activeJobs - 1, 0);
  }
}

export function startOrderDeliveryFailureWorker() {
  if (state.running) return;

  state.running = true;
  state.startedAt = Date.now();

  state.timer = setInterval(() => {
    void tick();
  }, env.orderAutomationPollMs);

  void tick();

  console.log("[delivery-failure] worker started", {
    pollMs: env.orderAutomationPollMs,
  });
}

export async function stopOrderDeliveryFailureWorker() {
  state.running = false;

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  console.log("[delivery-failure] worker stopped");
}

export async function getOrderDeliveryFailureWorkerStats() {
  return {
    running: state.running,
    startedAt: state.startedAt,
    activeJobs: state.activeJobs,
    processed: state.processed,
    reminders: state.reminders,
    retries: state.retries,
    returned: state.returned,
    cancelled: state.cancelled,
    failed: state.failed,
  };
}
