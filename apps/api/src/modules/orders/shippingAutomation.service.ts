import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import {
  calculateRefundItems,
  createRefundRecord,
  deriveParentOrderStatus,
  getRefundMethodForPayment,
  shouldCreateRefundForPayment,
  writeStatusHistory,
} from "./order-lifecycle.service.js";

const SHIPMENT_STALE_HOURS = 24;
const BRAND_RESPONSE_GRACE_HOURS = 24;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function runShippingAutomationSweep() {
  const staleShipmentCutoff = hoursAgo(SHIPMENT_STALE_HOURS);
  const brandResponseCutoff = hoursAgo(BRAND_RESPONSE_GRACE_HOURS);

  const staleShipped = await prisma.subOrder.findMany({
    where: {
      status: OrderStatus.SHIPPED,
      updatedAt: { lte: staleShipmentCutoff },
      brandReminderSentAt: null,
    },
    include: { order: true, brand: true },
    take: 50,
  });

  for (const subOrder of staleShipped) {
    queueNotificationEvent({
      name: notificationEventNames.orderShipped,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "SYSTEM",
      note: "Shipment has no tracking update for 24+ hours. Please update status or tracking details.",
      notifyAdmin: true,
    });

    await prisma.subOrder.update({
      where: { id: subOrder.id },
      data: { brandReminderSentAt: new Date() },
    });
  }

  const retryOverdue = await prisma.subOrder.findMany({
    where: {
      status: OrderStatus.DELIVERY_FAILED,
      nextAttemptDate: { lte: new Date() },
      brandReminderSentAt: { not: null },
      updatedAt: { lte: brandResponseCutoff },
    },
    include: { order: true, brand: true },
    take: 50,
  });

  for (const subOrder of retryOverdue) {
    queueNotificationEvent({
      name: notificationEventNames.orderDeliveryFailed,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      userId: subOrder.order.userId,
      brandId: subOrder.brandId,
      brandName: subOrder.brand.name,
      changedByRole: "SYSTEM",
      note: "Retry window passed without brand update. Escalated to admin for manual intervention.",
      notifyAdmin: true,
    });
  }

  const cancellationEscalations = await prisma.cancellationRequest.findMany({
    where: {
      status: "REQUESTED",
      expiresAt: { lte: new Date() },
      decidedAt: null,
    },
    include: {
      order: true,
      subOrder: { include: { brand: true } },
      brand: true,
    },
    take: 50,
  });

  for (const request of cancellationEscalations) {
    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
      });
      await tx.cancellationHistory.create({
        data: {
          cancellationRequestId: request.id,
          action: "EXPIRED",
          performedByRole: "SYSTEM",
          note: "Brand response window expired after 4 hours.",
        },
      });
    });

    queueNotificationEvent({
      name: notificationEventNames.cancellationRequestExpired,
      orderId: request.orderId,
      subOrderId: request.subOrderId,
      userId: request.order.userId,
      brandId: request.brandId,
      brandName: request.brand.name,
      changedByRole: "SYSTEM",
      note: "Brand response window expired. Admin review is required unless no courier evidence is present by the auto-approval deadline.",
      notifyAdmin: true,
    });
  }

  const autoApprovalCandidates = await prisma.cancellationRequest.findMany({
    where: {
      status: { in: ["REQUESTED", "EXPIRED"] },
      autoApproveAt: { lte: new Date() },
      trackingEvidence: null,
      evidenceUrl: null,
    },
    include: {
      order: true,
      subOrder: { include: { brand: true, items: true } },
      brand: true,
    },
    take: 50,
  });

  let cancellationAutoApprovedCount = 0;
  for (const request of autoApprovalCandidates) {
    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
          decisionNote: "Auto-approved after 8 hours without courier evidence.",
        },
      });

      await tx.cancellationHistory.create({
        data: {
          cancellationRequestId: request.id,
          action: "AUTO_APPROVED",
          performedByRole: "SYSTEM",
          note: "Auto-approved after 8 hours without courier evidence.",
        },
      });

      if (request.subOrder.status !== OrderStatus.CANCELED) {
        await tx.subOrder.update({
          where: { id: request.subOrderId },
          data: { status: OrderStatus.CANCELED },
        });

        await Promise.all(
          request.subOrder.items.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }),
          ),
        );

        await tx.subOrderStatusLog.create({
          data: {
            subOrderId: request.subOrderId,
            status: OrderStatus.CANCELED,
            updatedBy: "SYSTEM",
            note: "Cancellation request auto-approved after timeout.",
          },
        });

        await writeStatusHistory(tx, {
          subOrderId: request.subOrderId,
          oldStatus: request.subOrder.status,
          newStatus: OrderStatus.CANCELED,
          changedByRole: "SYSTEM",
          reason: request.reasonCode,
          note: "Cancellation request auto-approved after timeout.",
        });

        if (shouldCreateRefundForPayment(request.order.paymentMethod)) {
          const existingRefund = await tx.refundRequest.findFirst({
            where: { subOrderId: request.subOrderId, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
            select: { id: true },
          });

          if (!existingRefund) {
            const refund = calculateRefundItems(request.subOrder.items);
            if (refund.amountPkr > 0) {
              await createRefundRecord(tx, {
                orderId: request.orderId,
                subOrderId: request.subOrderId,
                requestedByRole: "SYSTEM",
                reasonCode: request.requestedByRole === "BRAND" ? "BRAND_CANCELLATION" : "CUSTOMER_CANCELLATION",
                reasonText: request.reasonText,
                method: getRefundMethodForPayment(request.order.paymentMethod),
                amountPkr: refund.amountPkr,
                items: refund.refundItems,
                note: "Auto-created after cancellation request auto-approval.",
              });
            }
          }
        }

        const refreshedSubOrders = await tx.subOrder.findMany({
          where: { orderId: request.orderId },
          select: { status: true },
        });
        const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((entry) => entry.status));

        await tx.order.update({
          where: { id: request.orderId },
          data: { status: nextParentStatus },
        });

        await tx.orderStatusLog.create({
          data: {
            orderId: request.orderId,
            status: nextParentStatus,
            updatedBy: "SYSTEM",
            note: "Cancellation request auto-approved after timeout.",
          },
        });
      }
    });

    cancellationAutoApprovedCount += 1;
    queueNotificationEvent({
      name: notificationEventNames.cancellationRequestApproved,
      orderId: request.orderId,
      subOrderId: request.subOrderId,
      userId: request.order.userId,
      brandId: request.brandId,
      brandName: request.brand.name,
      changedByRole: "SYSTEM",
      note: "Auto-approved after 8 hours without courier evidence.",
      notifyAdmin: true,
    });
  }

  return {
    staleShipmentCount: staleShipped.length,
    retryOverdueCount: retryOverdue.length,
    cancellationEscalationCount: cancellationEscalations.length,
    cancellationAutoApprovedCount,
  };
}

