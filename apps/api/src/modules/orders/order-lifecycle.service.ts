import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, RefundMethod, RefundReasonCode } from "@prisma/client";

export const AUTO_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
]);

export const CANCELLATION_REQUEST_STATUSES = new Set<OrderStatus>([
  OrderStatus.PACKED,
  OrderStatus.READY_FOR_PICKUP,
]);

export const POST_SHIPMENT_STATUSES = new Set<OrderStatus>([
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERY_FAILED,
  OrderStatus.ADDRESS_CORRECTION_REQUIRED,
  OrderStatus.READY_FOR_REDELIVERY,
  OrderStatus.SHIPMENT_RETURNED,
  OrderStatus.DELIVERED,
  OrderStatus.RETURNED,
]);

export const SUBORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELED],
  PROCESSING: [OrderStatus.PACKED, OrderStatus.CANCELED],
  PACKED: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELED],
  READY_FOR_PICKUP: [OrderStatus.SHIPPED, OrderStatus.CANCELED],
  PARTIALLY_SHIPPED: [OrderStatus.SHIPPED],
  SHIPPED: [OrderStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED],
  DELIVERY_FAILED: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.ADDRESS_CORRECTION_REQUIRED, OrderStatus.SHIPMENT_RETURNED],
  ADDRESS_CORRECTION_REQUIRED: [OrderStatus.READY_FOR_REDELIVERY],
  READY_FOR_REDELIVERY: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.SHIPMENT_RETURNED],
  SHIPMENT_RETURNED: [OrderStatus.CANCELED],
  DELIVERED: [],
  RETURNED: [OrderStatus.CANCELED],
  CANCELED: [],
};

export const BRAND_FULFILLMENT_STATUSES = new Set<OrderStatus>([
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERY_FAILED,
  OrderStatus.DELIVERED,
]);

export function canTransitionSubOrder(from: OrderStatus, to: OrderStatus) {
  return SUBORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidSubOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return;
  if (!canTransitionSubOrder(from, to)) {
    throw new Error(`INVALID_STATUS_TRANSITION:${from}:${to}`);
  }
}

export function normalizeOrderStatusInput(status: string): OrderStatus {
  if (status === "CANCELLED") return OrderStatus.CANCELED;
  if (status === "SHIPMENT_RETURNED" || status === "SHIPMENTRETURNED") return OrderStatus.SHIPMENT_RETURNED;
  return status as OrderStatus;
}

export function deriveParentOrderStatus(subOrderStatuses: OrderStatus[], paymentStatus?: PaymentStatus): OrderStatus {
  if (paymentStatus === PaymentStatus.FAILED && subOrderStatuses.every((status) => status === OrderStatus.PENDING || status === OrderStatus.CANCELED)) {
    return OrderStatus.PENDING;
  }
  if (subOrderStatuses.length === 0) return OrderStatus.PENDING;
  if (subOrderStatuses.every((status) => status === OrderStatus.PENDING)) return OrderStatus.PENDING;
  if (subOrderStatuses.every((status) => status === OrderStatus.CONFIRMED)) return OrderStatus.CONFIRMED;
  if (subOrderStatuses.every((status) => status === OrderStatus.CANCELED)) return OrderStatus.CANCELED;
  if (subOrderStatuses.every((status) => status === OrderStatus.SHIPMENT_RETURNED)) return OrderStatus.RETURNED;
  if (subOrderStatuses.every((status) => status === OrderStatus.DELIVERED)) return OrderStatus.DELIVERED;
  if (subOrderStatuses.some((status) => status === OrderStatus.ADDRESS_CORRECTION_REQUIRED)) return OrderStatus.ADDRESS_CORRECTION_REQUIRED;
  if (subOrderStatuses.some((status) => status === OrderStatus.READY_FOR_REDELIVERY)) return OrderStatus.READY_FOR_REDELIVERY;
  if (subOrderStatuses.some((status) => status === OrderStatus.DELIVERY_FAILED)) return OrderStatus.DELIVERY_FAILED;
  if (subOrderStatuses.some((status) => status === OrderStatus.OUT_FOR_DELIVERY)) return OrderStatus.OUT_FOR_DELIVERY;
  if (subOrderStatuses.some((status) => status === OrderStatus.SHIPMENT_RETURNED)) return OrderStatus.RETURNED;
  if (subOrderStatuses.some((status) => status === OrderStatus.SHIPPED)) return OrderStatus.PARTIALLY_SHIPPED;
  if (subOrderStatuses.some((status) => status === OrderStatus.READY_FOR_PICKUP || status === OrderStatus.PACKED || status === OrderStatus.PROCESSING)) {
    return OrderStatus.PROCESSING;
  }
  if (subOrderStatuses.some((status) => status === OrderStatus.DELIVERED) && subOrderStatuses.some((status) => status === OrderStatus.CANCELED)) {
    return OrderStatus.RETURNED;
  }
  return OrderStatus.PENDING;
}

export function getCancellationMode(status: OrderStatus): "AUTO" | "REQUEST" | "BLOCKED" | "ADMIN_ONLY" | "TERMINAL" {
  if (AUTO_CANCELLABLE_STATUSES.has(status)) return "AUTO";
  if (CANCELLATION_REQUEST_STATUSES.has(status)) return "REQUEST";
  if (status === OrderStatus.SHIPMENT_RETURNED) return "ADMIN_ONLY";
  if (status === OrderStatus.CANCELED) return "TERMINAL";
  return "BLOCKED";
}

export function getRefundMethodForPayment(paymentMethod: PaymentMethod, requested?: RefundMethod | null): RefundMethod {
  if (requested) return requested;
  return paymentMethod === PaymentMethod.COD ? RefundMethod.BANK_TRANSFER : RefundMethod.WALLET_CREDIT;
}

export function shouldCreateRefundForPayment(paymentMethod: PaymentMethod) {
  return paymentMethod !== PaymentMethod.COD;
}

export async function recordCodRefusalIfNeeded(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    paymentMethod: PaymentMethod;
    failureReason?: string | null;
    now?: Date;
  },
) {
  if (input.paymentMethod !== PaymentMethod.COD || input.failureReason !== "REFUSED_DELIVERY") return null;

  const now = input.now || new Date();
  const updated = await tx.user.update({
    where: { id: input.userId },
    data: {
      codRefusalCount: { increment: 1 },
      lastCodRefusalAt: now,
    },
    select: { codRefusalCount: true },
  });

  if (updated.codRefusalCount >= 3) {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        codReviewFlag: true,
        codReviewStatus: "FLAGGED",
        codPrepaymentRequired: true,
        codBlockedAt: updated.codRefusalCount >= 5 ? now : undefined,
      },
    });
  }

  return updated;
}

export async function writeStatusHistory(
  tx: Prisma.TransactionClient,
  input: {
    subOrderId: string;
    oldStatus?: OrderStatus | null;
    newStatus: OrderStatus;
    changedByRole: "SYSTEM" | "USER" | "BRAND" | "ADMIN";
    changedById?: string | null;
    reason?: string | null;
    note?: string | null;
  },
) {
  await tx.statusHistory.create({
    data: {
      subOrderId: input.subOrderId,
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus,
      changedByRole: input.changedByRole,
      changedById: input.changedById ?? null,
      reason: input.reason ?? null,
      note: input.note ?? null,
    },
  });
}

export function calculateRefundItems(
  items: Array<{ id: string; quantity: number; unitPricePkr: number }>,
  selectedItemIds?: string[],
) {
  const selected = selectedItemIds?.length ? items.filter((item) => selectedItemIds.includes(item.id)) : items;
  const refundItems = selected.map((item) => ({
    orderItemId: item.id,
    quantity: item.quantity,
    refundAmountPkr: item.unitPricePkr * item.quantity,
  }));
  const amountPkr = refundItems.reduce((sum, item) => sum + item.refundAmountPkr, 0);
  return { selected, refundItems, amountPkr };
}

export async function createRefundRecord(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    subOrderId: string;
    returnRequestId?: string | null;
    requestedByRole: "USER" | "BRAND" | "ADMIN" | "SYSTEM";
    requestedById?: string | null;
    reasonCode: RefundReasonCode;
    reasonText?: string | null;
    method: RefundMethod;
    amountPkr: number;
    items: Array<{ orderItemId: string; quantity: number; refundAmountPkr: number }>;
    note?: string | null;
  },
) {
  const completedRefundRequests = await tx.refundRequest.findMany({
    where: {
      subOrderId: input.subOrderId,
      status: "COMPLETED",
    },
    select: {
      items: {
        select: {
          orderItemId: true,
        },
      },
    },
  });

  const alreadyRefundedItemIds = new Set<string>();
  for (const refundRequest of completedRefundRequests) {
    for (const item of refundRequest.items) {
      alreadyRefundedItemIds.add(item.orderItemId);
    }
  }

  const refundableItems = input.items.filter((item) => !alreadyRefundedItemIds.has(item.orderItemId));
  if (!refundableItems.length) {
    return null;
  }

  const amountPkr = refundableItems.reduce((sum, item) => sum + item.refundAmountPkr, 0);

  const refund = await tx.refundRequest.create({
    data: {
      orderId: input.orderId,
      subOrderId: input.subOrderId,
      returnRequestId: input.returnRequestId ?? null,
      requestedByRole: input.requestedByRole,
      requestedById: input.requestedById ?? null,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText ?? null,
      method: input.method,
      amountPkr,
      currency: "PKR",
      status: "PENDING",
      reviewNote: input.note ?? null,
      items: {
        create: refundableItems,
      },
    },
  });

  await tx.refundStatusLog.create({
    data: {
      refundRequestId: refund.id,
      status: "PENDING",
      updatedBy: input.requestedByRole === "USER" ? "USER" : input.requestedByRole,
      updatedById: input.requestedById ?? null,
      note: input.note ?? input.reasonText ?? input.reasonCode,
    },
  });

  await tx.refundHistory.create({
    data: {
      refundRequestId: refund.id,
      oldStatus: null,
      newStatus: "PENDING",
      performedByRole: input.requestedByRole === "USER" ? "USER" : input.requestedByRole,
      performedById: input.requestedById ?? null,
      adjustedAmount: input.amountPkr,
      note: input.note ?? input.reasonText ?? input.reasonCode,
    },
  });

  return refund;
}
