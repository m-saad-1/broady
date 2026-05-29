import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";

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

  return {
    staleShipmentCount: staleShipped.length,
    retryOverdueCount: retryOverdue.length,
  };
}

