import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { notificationEventNames } from "../modules/notifications/notification.events.js";
import { queueNotificationEvent } from "../modules/notifications/notification.service.js";
import { inferReturnRequestType, normalizeReturnRequestForApi } from "../modules/orders/return-workflow.js";
import { runShippingAutomationSweep } from "../modules/orders/shippingAutomation.service.js";
import { creditWallet } from "../modules/users/wallet.service.js";
import {
  deriveParentOrderStatus,
  writeStatusHistory,
  shouldCreateRefundForPayment,
  calculateRefundItems,
  createRefundRecord,
  getRefundMethodForPayment,
} from "../modules/orders/order-lifecycle.service.js";

const router = Router();
const OPEN_ORDER_STATUSES = new Set(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"]);
const RETURN_WORKFLOW_STATUSES = [
  "REQUESTED",
  "BRAND_REVIEWING",
  "NEED_MORE_EVIDENCE",
  "BRAND_APPROVED",
  "BRAND_REJECTED",
  "ADMIN_REVIEWING",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "REVIEWING",
  "APPROVED",
  "REJECTED",
  "RETURN_ARRANGED",
  "PICKUP_SCHEDULED",
  "RETURN_IN_TRANSIT",
  "IN_TRANSIT",
  "RETURN_RECEIVED",
  "RETURN_CONDITION_APPROVED",
  "RETURN_CONDITION_DISPUTED",
  "RECEIVED",
  "REFUND_INITIATED",
  "REFUND_PROCESSING",
  "REFUND_COMPLETED",
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
  "COMPLETED",
  "EXCHANGE_COMPLETED",
] as const;

router.use(requireAuth, requireAdmin);

router.get("/summary", async (_req, res) => {
  const [brandCount, productCount, orderCount, subOrderCount] = await Promise.all([
    prisma.brand.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.subOrder.count(),
  ]);

  return res.json({
    data: {
      brandCount,
      productCount,
      orderCount,
      subOrderCount,
    },
  });
});

router.get("/orders", async (_req, res) => {
  void runShippingAutomationSweep().catch(() => undefined);
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      items: { include: { product: true, brand: true } },
      subOrders: {
        include: {
          brand: true,
          items: { include: { product: true, brand: true } },
          statusLogs: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return res.json({ data: orders });
});

router.get("/operations", async (req, res) => {
  const db = prisma as any;
  const query = z
    .object({
      refundStatus: z.enum(["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED"]).optional(),
      returnStatus: z.enum(RETURN_WORKFLOW_STATUSES).optional(),
      onlyEscalated: z.coerce.boolean().optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: "Invalid query", issues: query.error.flatten() });
  }

  const now = new Date();
  const stuckCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const failedEscalationCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [refundRequests, returnRequests, failedDeliveries, stuckShipments] = await Promise.all([
    db.refundRequest.findMany({
      where: { status: query.data.refundStatus },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true } },
        subOrder: { select: { id: true, brandId: true, subtotalPkr: true, status: true, brand: { select: { name: true } } } },
        items: { include: { orderItem: { include: { product: { select: { id: true, name: true, imageUrl: true } } } } } },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.returnRequest.findMany({
      where: { status: query.data.returnStatus },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            paymentMethod: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        subOrder: {
          select: {
            id: true,
            brandId: true,
            subtotalPkr: true,
            status: true,
            brand: { select: { id: true, name: true } },
            items: {
              include: {
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
      take: 200,
    }),
    prisma.subOrder.findMany({
      where: { status: "DELIVERY_FAILED" },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 200,
    }),
    prisma.subOrder.findMany({
      where: { status: "SHIPPED", updatedAt: { lte: stuckCutoff } },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 200,
    }),
  ]);

  const escalatedFailures = failedDeliveries.filter(
    (entry: any) =>
      (entry.nextAttemptDate && entry.nextAttemptDate <= now) ||
      entry.updatedAt <= failedEscalationCutoff,
  );

  return res.json({
    data: {
      refundRequests,
      returnRequests: returnRequests.map((request: any) => normalizeReturnRequestForApi(request)),
      failedDeliveries: query.data.onlyEscalated ? escalatedFailures : failedDeliveries,
      stuckShipments,
      disputes: refundRequests.filter((entry: any) => entry.status === "REJECTED"),
      escalations: {
        failedDeliveryEscalations: escalatedFailures,
        noBrandResponse: failedDeliveries.filter((entry: any) => entry.updatedAt <= failedEscalationCutoff),
      },
    },
  });
});

router.get("/cancellation-requests", async (req, res) => {
  const query = z
    .object({
      status: z.enum(["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED_BY_USER"]).optional(),
    })
    .safeParse(req.query);

  if (!query.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  const db = prisma as any;
  const requests = await db.cancellationRequest.findMany({
    where: query.data.status ? { status: query.data.status } : undefined,
    include: {
      order: { select: { id: true, userId: true, paymentMethod: true } },
      subOrder: { select: { id: true, brandId: true, subtotalPkr: true, status: true, items: { include: { product: { select: { name: true } } } } } },
      brand: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return res.json({ data: requests });
});

router.patch("/cancellation-requests/:requestId/status", async (req, res) => {
  const payload = z
    .object({
      status: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().trim().max(500).optional(),
      refundMethod: z.enum(["ORIGINAL_SOURCE", "BANK_TRANSFER", "WALLET_CREDIT"]).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const db = prisma as any;
  const request = await db.cancellationRequest.findUnique({
    where: { id: String(req.params.requestId) },
    include: {
      order: true,
      subOrder: {
        include: {
          brand: { select: { id: true, name: true } },
          items: true,
        },
      },
    },
  });

  if (!request) return res.status(404).json({ message: "Cancellation request not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.cancellationRequest.update({
      where: { id: request.id },
      data: {
        status: payload.data.status,
        decisionNote: payload.data.note || request.decisionNote,
        decidedById: req.auth!.userId,
        decidedAt: new Date(),
      },
    });

    if (payload.data.status === "APPROVED") {
      await dbTx.subOrder.update({
        where: { id: request.subOrderId },
        data: { status: "CANCELED" },
      });

      await Promise.all(
        request.subOrder.items.map((item: any) =>
          dbTx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          })
        )
      );

      await dbTx.subOrderStatusLog.create({
        data: {
          subOrderId: request.subOrderId,
          status: "CANCELED",
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note: payload.data.note || "Cancellation request approved by admin.",
        },
      });

      await writeStatusHistory(tx, {
        subOrderId: request.subOrderId,
        oldStatus: request.subOrder.status,
        newStatus: "CANCELED",
        changedByRole: "ADMIN",
        changedById: req.auth!.userId,
        reason: request.reasonCode,
        note: payload.data.note || "Cancellation request approved by admin.",
      });

      if (shouldCreateRefundForPayment(request.order.paymentMethod) && request.order.paymentStatus === "COMPLETED") {
        const existingRefund = await dbTx.refundRequest.findFirst({
          where: { subOrderId: request.subOrderId, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
          select: { id: true },
        });

        if (!existingRefund) {
          const refund = calculateRefundItems(request.subOrder.items);
          if (refund.amountPkr > 0) {
            await createRefundRecord(tx, {
              orderId: request.orderId,
              subOrderId: request.subOrderId,
              requestedByRole: "ADMIN",
              requestedById: req.auth!.userId,
              reasonCode: "CUSTOMER_CANCELLATION",
              reasonText: request.reasonText,
              method: payload.data.refundMethod || getRefundMethodForPayment(request.order.paymentMethod),
              amountPkr: refund.amountPkr,
              items: refund.refundItems,
              note: payload.data.note || "Created after admin cancellation approval.",
            });
          }
        }
      }

      const refreshedSubOrders = await dbTx.subOrder.findMany({
        where: { orderId: request.orderId },
        select: { status: true },
      });
      const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((entry: any) => entry.status));

      await dbTx.order.update({
        where: { id: request.orderId },
        data: { status: nextParentStatus },
      });

      await dbTx.orderStatusLog.create({
        data: {
          orderId: request.orderId,
          status: nextParentStatus,
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note: payload.data.note || "Cancellation request approved by admin.",
        },
      });

    } else if (payload.data.status === "REJECTED") {
      // Restore the original suborder status so fulfillment resumes from the exact stage it stopped
      const originalStatus = request.subOrder.status;
      await dbTx.subOrder.update({
        where: { id: request.subOrderId },
        data: { status: originalStatus },
      });

      await dbTx.subOrderStatusLog.create({
        data: {
          subOrderId: request.subOrderId,
          status: originalStatus,
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note: payload.data.note || "Cancellation request rejected by admin. Fulfillment continues from previous stage.",
        },
      });

      await writeStatusHistory(tx, {
        subOrderId: request.subOrderId,
        oldStatus: request.subOrder.status,
        newStatus: originalStatus,
        changedByRole: "ADMIN",
        changedById: req.auth!.userId,
        reason: request.reasonCode,
        note: payload.data.note || "Cancellation request rejected by admin. Fulfillment continues from previous stage.",
      });

      const refreshedSubOrders = await dbTx.subOrder.findMany({
        where: { orderId: request.orderId },
        select: { status: true },
      });
      const nextParentStatus = deriveParentOrderStatus(refreshedSubOrders.map((entry: any) => entry.status));

      await dbTx.order.update({
        where: { id: request.orderId },
        data: { status: nextParentStatus },
      });

      await dbTx.orderStatusLog.create({
        data: {
          orderId: request.orderId,
          status: nextParentStatus,
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note: payload.data.note || "Cancellation request rejected by admin.",
        },
      });
    }

    await dbTx.cancellationHistory.create({
      data: {
        cancellationRequestId: request.id,
        action: payload.data.status === "APPROVED" ? "APPROVED" : "REJECTED",
        performedByRole: "ADMIN",
        performedById: req.auth!.userId,
        note: payload.data.note?.trim() || payload.data.status,
      },
    });

    return next;
  });

  queueNotificationEvent({
    name: payload.data.status === "APPROVED"
      ? notificationEventNames.cancellationRequestApproved
      : notificationEventNames.cancellationRequestRejected,
    orderId: request.orderId,
    subOrderId: request.subOrderId,
    userId: request.order.userId,
    brandId: request.brandId,
    brandName: request.subOrder.brand?.name || undefined,
    changedByRole: "ADMIN",
    note: payload.data.note || undefined,
  });

  return res.json({ data: updated });
});

router.patch("/refund-requests/:refundRequestId/status", async (req, res) => {
  const payload = z
    .object({
      action: z.enum([
        "APPROVE_REFUND",
        "REJECT_REFUND",
        "RETRY_FAILED_REFUND",
        "MARK_MANUAL_REFUND_COMPLETED",
        "MARK_GATEWAY_REFUND_COMPLETED",
        "MARK_GATEWAY_REFUND_FAILED",
      ]),
      note: z.string().trim().max(500).optional(),
      method: z.enum(["ORIGINAL_SOURCE", "BANK_TRANSFER", "WALLET_CREDIT"]).optional(),
      adjustedAmountPkr: z.coerce.number().int().positive().optional(),
      gatewayRefundId: z.string().trim().max(160).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const db = prisma as any;
  const refundRequest = await db.refundRequest.findUnique({
    where: { id: String(req.params.refundRequestId) },
    include: { order: true, subOrder: true, returnRequest: true },
  });
  if (!refundRequest) return res.status(404).json({ message: "Refund request not found" });
  const refundActionPayload = payload.data;

  const currentMethod = refundActionPayload.method || refundRequest.method || "ORIGINAL_SOURCE";
  const currentAmount = refundActionPayload.adjustedAmountPkr ?? refundRequest.adjustedAmountPkr ?? refundRequest.amountPkr;

  if (refundActionPayload.action === "APPROVE_REFUND" && refundRequest.status !== "PENDING") {
    return res.status(409).json({ message: "Only pending refunds can be approved." });
  }
  if (refundActionPayload.action === "REJECT_REFUND" && refundRequest.status !== "PENDING") {
    return res.status(409).json({ message: "Only pending refunds can be rejected." });
  }
  if (refundActionPayload.action === "RETRY_FAILED_REFUND" && refundRequest.status !== "FAILED") {
    return res.status(409).json({ message: "Only failed refunds can be retried." });
  }
  if (
    (refundActionPayload.action === "MARK_MANUAL_REFUND_COMPLETED" || refundActionPayload.action === "MARK_GATEWAY_REFUND_COMPLETED" || refundActionPayload.action === "MARK_GATEWAY_REFUND_FAILED") &&
    refundRequest.status !== "PROCESSING"
  ) {
    return res.status(409).json({ message: "Refund must be in processing state for this action." });
  }
  if (refundActionPayload.action === "MARK_MANUAL_REFUND_COMPLETED" && currentMethod === "ORIGINAL_SOURCE") {
    return res.status(409).json({ message: "Manual completion is only available for manual refund methods." });
  }
  if (refundActionPayload.action === "MARK_MANUAL_REFUND_COMPLETED" && (!refundActionPayload.gatewayRefundId?.trim() || !refundActionPayload.note?.trim())) {
    return res.status(400).json({ message: "Manual refund completion requires a transaction reference and note." });
  }
  if (refundActionPayload.action === "REJECT_REFUND" && !refundActionPayload.note?.trim()) {
    return res.status(400).json({ message: "A rejection note is required when rejecting a refund." });
  }

  const notificationStates: Array<{ status: string; note: string }> = [];

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    let workingStatus = refundRequest.status;
    let workingReturnStatus = refundRequest.returnRequest?.status || "REFUND_INITIATED";
    const now = new Date();

    async function writeRefundAudit(nextStatus: "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "FAILED", note: string) {
      await dbTx.refundStatusLog.create({
        data: {
          refundRequestId: refundRequest.id,
          status: nextStatus,
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note,
        },
      });
      await dbTx.refundHistory.create({
        data: {
          refundRequestId: refundRequest.id,
          oldStatus: workingStatus,
          newStatus: nextStatus,
          performedByRole: "ADMIN",
          performedById: req.auth!.userId,
          adjustedAmount: currentAmount,
          gatewayReference: refundActionPayload.gatewayRefundId?.trim() || refundRequest.gatewayRefundId || null,
          note,
        },
      });
      workingStatus = nextStatus;
      notificationStates.push({ status: nextStatus, note });
    }

    async function moveReturnWorkflow(nextStatus: "REFUND_PROCESSING" | "REFUND_COMPLETED" | "COMPLETED", note: string) {
      if (!refundRequest.returnRequestId) return;
      await dbTx.returnStatusLog.create({
        data: {
          returnRequestId: refundRequest.returnRequestId,
          status: nextStatus,
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note,
        },
      });
      await dbTx.returnHistory.create({
        data: {
          returnRequestId: refundRequest.returnRequestId,
          oldStatus: workingReturnStatus,
          newStatus: nextStatus,
          performedByRole: "ADMIN",
          performedById: req.auth!.userId,
          note,
        },
      });
      workingReturnStatus = nextStatus;
    }

    if (refundActionPayload.action === "APPROVE_REFUND") {
      const approvalNote = refundActionPayload.note?.trim() || "Admin confirmed and validated refund.";
      await dbTx.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: "COMPLETED",
          reviewNote: approvalNote,
          method: currentMethod,
          adjustedAmountPkr: currentAmount,
          gatewayRefundId: refundActionPayload.gatewayRefundId?.trim() || refundRequest.gatewayRefundId || "AUTO_VALIDATED",
          completedAt: now,
        },
      });
      await writeRefundAudit("APPROVED", "Admin approved refund.");
      await writeRefundAudit("COMPLETED", approvalNote);

      await tx.subOrder.update({
        where: { id: refundRequest.subOrderId },
        data: { refundProcessedAt: now },
      });

      await creditWallet(tx, {
        userId: refundRequest.order.userId,
        amountPkr: currentAmount,
        sourceType: "REFUND",
        note: approvalNote,
        orderId: refundRequest.orderId,
        refundRequestId: refundRequest.id,
      });

      if (refundRequest.returnRequestId) {
        await dbTx.returnRequest.update({
          where: { id: refundRequest.returnRequestId },
          data: {
            status: "COMPLETED",
            refundStatusSnapshot: "COMPLETED",
            completedAt: now,
          },
        });
        await moveReturnWorkflow("REFUND_COMPLETED", approvalNote);
        await moveReturnWorkflow("COMPLETED", "Return workflow completed after refund settlement.");
      }
    }

    if (refundActionPayload.action === "REJECT_REFUND") {
      const rejectionNote = refundActionPayload.note!.trim();
      await dbTx.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: "REJECTED",
          reviewNote: rejectionNote,
          method: currentMethod,
          adjustedAmountPkr: currentAmount,
        },
      });
      await writeRefundAudit("REJECTED", rejectionNote);
      if (refundRequest.returnRequestId) {
        await dbTx.returnRequest.update({
          where: { id: refundRequest.returnRequestId },
          data: { refundStatusSnapshot: "REJECTED" },
        });
      }
    }

    if (refundActionPayload.action === "RETRY_FAILED_REFUND") {
      const retryNote = refundActionPayload.note?.trim() || "Refund retry validated and completed.";
      await dbTx.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: "COMPLETED",
          reviewNote: retryNote,
          method: currentMethod,
          adjustedAmountPkr: currentAmount,
          gatewayRefundId: refundActionPayload.gatewayRefundId?.trim() || refundRequest.gatewayRefundId || "AUTO_VALIDATED_RETRY",
          completedAt: now,
        },
      });
      await writeRefundAudit("COMPLETED", retryNote);

      await tx.subOrder.update({
        where: { id: refundRequest.subOrderId },
        data: { refundProcessedAt: now },
      });

      await creditWallet(tx, {
        userId: refundRequest.order.userId,
        amountPkr: currentAmount,
        sourceType: "REFUND",
        note: retryNote,
        orderId: refundRequest.orderId,
        refundRequestId: refundRequest.id,
      });

      if (refundRequest.returnRequestId) {
        await dbTx.returnRequest.update({
          where: { id: refundRequest.returnRequestId },
          data: {
            status: "COMPLETED",
            refundStatusSnapshot: "COMPLETED",
            completedAt: now,
          },
        });
        await moveReturnWorkflow("REFUND_COMPLETED", retryNote);
        await moveReturnWorkflow("COMPLETED", "Return workflow completed after refund settlement.");
      }
    }

    if (refundActionPayload.action === "MARK_GATEWAY_REFUND_FAILED") {
      const failureNote = refundActionPayload.note?.trim() || "Gateway reported refund failure.";
      await dbTx.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: "FAILED",
          reviewNote: failureNote,
          gatewayRefundId: refundActionPayload.gatewayRefundId?.trim() || refundRequest.gatewayRefundId,
        },
      });
      await writeRefundAudit("FAILED", failureNote);
      if (refundRequest.returnRequestId) {
        await dbTx.returnRequest.update({
          where: { id: refundRequest.returnRequestId },
          data: { refundStatusSnapshot: "FAILED" },
        });
      }
    }

    if (refundActionPayload.action === "MARK_MANUAL_REFUND_COMPLETED" || refundActionPayload.action === "MARK_GATEWAY_REFUND_COMPLETED") {
      const completionNote =
        refundActionPayload.action === "MARK_MANUAL_REFUND_COMPLETED"
          ? refundActionPayload.note!.trim()
          : refundActionPayload.note?.trim() || "Gateway confirmed refund completion.";
      await dbTx.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: "COMPLETED",
          reviewNote: completionNote,
          method: currentMethod,
          adjustedAmountPkr: currentAmount,
          gatewayRefundId: refundActionPayload.gatewayRefundId?.trim() || refundRequest.gatewayRefundId,
          completedAt: now,
        },
      });
      await writeRefundAudit("COMPLETED", completionNote);
      await tx.subOrder.update({
        where: { id: refundRequest.subOrderId },
        data: { refundProcessedAt: now },
      });
      await creditWallet(tx, {
        userId: refundRequest.order.userId,
        amountPkr: currentAmount,
        sourceType: "REFUND",
        note: completionNote,
        orderId: refundRequest.orderId,
        refundRequestId: refundRequest.id,
      });
      if (refundRequest.returnRequestId) {
        await dbTx.returnRequest.update({
          where: { id: refundRequest.returnRequestId },
          data: {
            status: "COMPLETED",
            refundStatusSnapshot: "COMPLETED",
            completedAt: now,
          },
        });
        await moveReturnWorkflow("REFUND_COMPLETED", completionNote);
        await moveReturnWorkflow("COMPLETED", "Return workflow completed after refund settlement.");
      }
    }

    return dbTx.refundRequest.findUniqueOrThrow({
      where: { id: refundRequest.id },
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
            order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
            subOrder: {
              include: {
                brand: { select: { id: true, name: true } },
                items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
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
        statusLogs: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });
  });

  for (const notificationState of notificationStates) {
    queueNotificationEvent({
      name: notificationEventNames.refundStateUpdated,
      orderId: refundRequest.orderId,
      subOrderId: refundRequest.subOrderId,
      returnRequestId: refundRequest.returnRequestId || undefined,
      requestType: refundRequest.returnRequest ? inferReturnRequestType(refundRequest.returnRequest) : undefined,
      userId: refundRequest.order.userId,
      brandId: refundRequest.subOrder.brandId,
      paymentMethod: refundRequest.order.paymentMethod,
      reason: `Refund is now ${notificationState.status}: ${notificationState.note}`,
    });
  }

  if (updated.status === "COMPLETED") {
    queueNotificationEvent({
      name: notificationEventNames.refundProcessed,
      orderId: refundRequest.orderId,
      subOrderId: refundRequest.subOrderId,
      returnRequestId: refundRequest.returnRequestId || undefined,
      requestType: refundRequest.returnRequest ? inferReturnRequestType(refundRequest.returnRequest) : undefined,
      userId: refundRequest.order.userId,
      paymentMethod: refundRequest.order.paymentMethod,
      reason: updated.reviewNote || undefined,
    });
  }

  return res.json({ data: updated });
});

router.get("/refund-requests/:refundRequestId", async (req, res) => {
  const refundRequest = await prisma.refundRequest.findUnique({
    where: { id: String(req.params.refundRequestId) },
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
          order: { select: { id: true, userId: true, paymentMethod: true, createdAt: true } },
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
  });

  if (!refundRequest) {
    return res.status(404).json({ message: "Refund request not found" });
  }

  return res.json({ data: refundRequest });
});

router.get("/return-requests/:returnRequestId", async (req, res) => {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id: String(req.params.returnRequestId) },
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
  });

  if (!returnRequest) {
    return res.status(404).json({ message: "Return request not found" });
  }

  return res.json({ data: normalizeReturnRequestForApi(returnRequest) });
});

router.patch("/return-requests/:returnRequestId/status", async (req, res) => {
  const payload = z
    .object({
      status: z.enum(RETURN_WORKFLOW_STATUSES),
      note: z.string().trim().max(500).optional(),
      pickupTracking: z.string().trim().max(160).optional(),
      pickupCourier: z.string().trim().max(80).optional(),
      pickupDate: z.coerce.date().optional(),
      pickupAddress: z.string().trim().max(240).optional(),
      returnTrackingNumber: z.string().trim().max(160).optional(),
      rejectedReason: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  if (["BRAND_APPROVED", "RETURN_ARRANGED", "RETURN_IN_TRANSIT", "RETURN_RECEIVED"].includes(payload.data.status)) {
    return res.status(400).json({ message: "These operational return statuses are managed by the brand, not admin." });
  }

  const db = prisma as any;
  const returnRequest = await db.returnRequest.findUnique({
    where: { id: String(req.params.returnRequestId) },
    include: {
      order: true,
      subOrder: { include: { brand: true } },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!returnRequest) return res.status(404).json({ message: "Return request not found" });

  const currentStatus = returnRequest.status as string;

  if (
    payload.data.status === "ADMIN_REJECTED" &&
    currentStatus !== "BRAND_REJECTED" &&
    !payload.data.rejectedReason?.trim() &&
    !payload.data.note?.trim()
  ) {
    return res.status(400).json({ message: "Rejected requests require a rejected reason or admin note." });
  }

  const requestType = inferReturnRequestType(returnRequest);
  const note = payload.data.note?.trim();
  const rejectedReason = payload.data.rejectedReason?.trim();
  const resolvedAdminStatus =
    payload.data.status === "ADMIN_APPROVED" && currentStatus === "RETURN_CONDITION_DISPUTED"
      ? requestType === "EXCHANGE"
        ? "REPLACEMENT_PROCESSING"
        : "RETURN_CONDITION_APPROVED"
      : payload.data.status;

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: resolvedAdminStatus,
        requestType,
        reviewNote: note || returnRequest.reviewNote,
        adminDecision:
          currentStatus === "BRAND_REJECTED"
            ? payload.data.status === "ADMIN_APPROVED"
              ? "REJECTED"
              : "APPROVED"
            : payload.data.status === "ADMIN_APPROVED"
              ? "APPROVED"
              : payload.data.status === "ADMIN_REJECTED"
                ? "REJECTED"
                : returnRequest.adminDecision,
        adminDecisionNote: note || returnRequest.adminDecisionNote,
        adminRejectedReason: rejectedReason || returnRequest.adminRejectedReason,
        pickupTracking: payload.data.pickupTracking?.trim() || returnRequest.pickupTracking,
        pickupCourier: payload.data.pickupCourier?.trim() || returnRequest.pickupCourier,
        pickupDate: payload.data.pickupDate || returnRequest.pickupDate,
        pickupAddress: payload.data.pickupAddress?.trim() || returnRequest.pickupAddress,
        returnTrackingNumber: payload.data.returnTrackingNumber?.trim() || payload.data.pickupTracking?.trim() || returnRequest.returnTrackingNumber,
        replacementUnavailable:
          payload.data.status === "ADMIN_APPROVED" && currentStatus === "BRAND_REJECTED"
            ? false
            : returnRequest.replacementUnavailable,
        refundStatusSnapshot:
          resolvedAdminStatus === "REFUND_INITIATED"
            ? "INITIATED"
            : resolvedAdminStatus === "REFUND_PROCESSING"
              ? "PROCESSING"
              : resolvedAdminStatus === "REFUND_COMPLETED"
                ? "COMPLETED"
                : returnRequest.refundStatusSnapshot,
        replacementStatus:
          resolvedAdminStatus === "REPLACEMENT_PROCESSING"
            ? "REPLACEMENT_PROCESSING"
            : resolvedAdminStatus === "REPLACEMENT_PACKED"
              ? "REPLACEMENT_PACKED"
            : resolvedAdminStatus === "REPLACEMENT_READY_FOR_PICKUP"
                ? "REPLACEMENT_READY_FOR_PICKUP"
            : resolvedAdminStatus === "REPLACEMENT_OUT_FOR_DELIVERY"
                ? "REPLACEMENT_OUT_FOR_DELIVERY"
            : resolvedAdminStatus === "REPLACEMENT_DELIVERY_FAILED"
                ? "REPLACEMENT_DELIVERY_FAILED"
            : resolvedAdminStatus === "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
                ? "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED"
            : resolvedAdminStatus === "REPLACEMENT_READY_FOR_REDELIVERY"
                ? "REPLACEMENT_READY_FOR_REDELIVERY"
            : resolvedAdminStatus === "REPLACEMENT_SHIPMENT_RETURNED"
                ? "REPLACEMENT_SHIPMENT_RETURNED"
            : resolvedAdminStatus === "REPLACEMENT_SHIPPED"
              ? "REPLACEMENT_SHIPPED"
              : resolvedAdminStatus === "REPLACEMENT_DELIVERED"
                ? "REPLACEMENT_DELIVERED"
                : resolvedAdminStatus === "EXCHANGE_COMPLETED"
                  ? "EXCHANGE_COMPLETED"
                  : returnRequest.replacementStatus,
        replacementDeliveredAt:
          resolvedAdminStatus === "REPLACEMENT_DELIVERED" ? new Date() : returnRequest.replacementDeliveredAt,
        completedAt:
          resolvedAdminStatus === "COMPLETED" || resolvedAdminStatus === "EXCHANGE_COMPLETED"
            ? new Date()
            : returnRequest.completedAt,
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
    });

    const isOverruling = resolvedAdminStatus === "ADMIN_APPROVED" && currentStatus === "BRAND_REJECTED";
    const isConfirmingBrandRejection = resolvedAdminStatus === "ADMIN_REJECTED" && currentStatus === "BRAND_REJECTED";
    const timelineNote = isOverruling
      ? `Decision: REJECTED. Admin overruled brand rejection and approved the customer request${note ? `: ${note}` : ""}`
      : isConfirmingBrandRejection
        ? `Decision: APPROVED. Admin confirmed brand rejection and finalized the customer request as rejected${note ? `: ${note}` : ""}`
        : note || rejectedReason || undefined;

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: returnRequest.id,
        status: resolvedAdminStatus,
        updatedBy: "ADMIN",
        updatedById: req.auth!.userId,
        note: timelineNote,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: returnRequest.id,
        oldStatus: returnRequest.status,
        newStatus: resolvedAdminStatus,
        performedByRole: "ADMIN",
        performedById: req.auth!.userId,
        note: timelineNote,
      },
    });

    if (resolvedAdminStatus === "REFUND_INITIATED") {
      const existingRefund = await dbTx.refundRequest.findFirst({
        where: {
          returnRequestId: returnRequest.id,
          status: { in: ["PENDING", "APPROVED", "PROCESSING"] },
        },
      });
      if (!existingRefund) {
        const refundRequest = await dbTx.refundRequest.create({
          data: {
            orderId: returnRequest.orderId,
            subOrderId: returnRequest.subOrderId,
            returnRequestId: returnRequest.id,
            requestedByRole: "ADMIN",
            requestedById: req.auth!.userId,
            reasonCode: "RETURNED_PRODUCT",
            method: returnRequest.order.paymentMethod === "COD" ? "BANK_TRANSFER" : "ORIGINAL_SOURCE",
            amountPkr: returnRequest.subOrder.subtotalPkr,
            status: "PENDING",
            reviewNote: note || "Refund initiated by admin.",
          },
        });
        await dbTx.refundStatusLog.create({
          data: {
            refundRequestId: refundRequest.id,
            status: "PENDING",
            updatedBy: "ADMIN",
            updatedById: req.auth!.userId,
            note: note || "Refund initiated by admin.",
          },
        });
      }
    }

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: returnRequest.orderId,
    subOrderId: returnRequest.subOrderId,
    returnRequestId: returnRequest.id,
    requestType,
    userId: returnRequest.order.userId,
    brandId: returnRequest.subOrder.brandId,
    note:
      resolvedAdminStatus === "ADMIN_APPROVED" && currentStatus === "BRAND_REJECTED"
        ? `Decision: REJECTED. Admin overruled brand rejection and approved the customer request${note ? `: ${note}` : ""}`
        : resolvedAdminStatus === "ADMIN_REJECTED" && currentStatus === "BRAND_REJECTED"
          ? `Decision: APPROVED. Admin confirmed brand rejection${note ? `: ${note}` : ""}`
          : `Return request is now ${resolvedAdminStatus}${note ? `: ${note}` : ""}`,
    changedByRole: "ADMIN",
    notifyAdmin: true,
  });

  if (resolvedAdminStatus === "COMPLETED" || resolvedAdminStatus === "EXCHANGE_COMPLETED") {
    await prisma.subOrder.update({
      where: { id: returnRequest.subOrderId },
      data: { status: "RETURNED" },
    });
  }

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.patch("/return-requests/:returnRequestId/convert-to-refund", async (req, res) => {
  const payload = z
    .object({
      note: z.string().trim().min(3).max(500),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const db = prisma as any;
  const returnRequest = await db.returnRequest.findUnique({
    where: { id: String(req.params.returnRequestId) },
    include: {
      order: true,
      subOrder: { include: { brand: true } },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!returnRequest) return res.status(404).json({ message: "Return request not found" });
  if (inferReturnRequestType(returnRequest) !== "EXCHANGE") {
    return res.status(409).json({ message: "Only exchange requests can be converted to a refund." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        convertedToRefund: true,
        replacementUnavailable: true,
        replacementUnavailableReason: payload.data.note,
        replacementStatus: "EXCHANGE_UNFULFILLABLE",
        status: "REFUND_INITIATED",
        adminDecision: "APPROVED",
        adminDecisionNote: payload.data.note,
        refundStatusSnapshot: "INITIATED",
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
    });

    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: returnRequest.id,
        status: "REFUND_INITIATED",
        updatedBy: "ADMIN",
        updatedById: req.auth!.userId,
        note: payload.data.note,
      },
    });

    await dbTx.returnHistory.create({
      data: {
        returnRequestId: returnRequest.id,
        oldStatus: returnRequest.status,
        newStatus: "REFUND_INITIATED",
        performedByRole: "ADMIN",
        performedById: req.auth!.userId,
        note: payload.data.note,
      },
    });

    const existingRefund = await dbTx.refundRequest.findFirst({
      where: {
        returnRequestId: returnRequest.id,
        status: { in: ["PENDING", "APPROVED", "PROCESSING"] },
      },
    });
    if (!existingRefund) {
      const refundRequest = await dbTx.refundRequest.create({
        data: {
          orderId: returnRequest.orderId,
          subOrderId: returnRequest.subOrderId,
          returnRequestId: returnRequest.id,
          requestedByRole: "ADMIN",
          requestedById: req.auth!.userId,
          reasonCode: "RETURNED_PRODUCT",
          reasonText: "Exchange converted to refund.",
          method: returnRequest.order.paymentMethod === "COD" ? "BANK_TRANSFER" : "ORIGINAL_SOURCE",
          amountPkr: returnRequest.subOrder.subtotalPkr,
          status: "PENDING",
          reviewNote: payload.data.note,
        },
      });
      await dbTx.refundStatusLog.create({
        data: {
          refundRequestId: refundRequest.id,
          status: "PENDING",
          updatedBy: "ADMIN",
          updatedById: req.auth!.userId,
          note: payload.data.note,
        },
      });
    }

    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.returnStateUpdated,
    orderId: returnRequest.orderId,
    subOrderId: returnRequest.subOrderId,
    returnRequestId: returnRequest.id,
    requestType: "EXCHANGE",
    userId: returnRequest.order.userId,
    brandId: returnRequest.subOrder.brandId,
    note: `Exchange converted to refund: ${payload.data.note}`,
    changedByRole: "ADMIN",
    notifyAdmin: true,
  });

  return res.json({ data: normalizeReturnRequestForApi(updated) });
});

router.get("/orders/:orderId", async (req, res) => {
  const orderId = String(req.params.orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      items: {
        include: {
          product: { include: { brand: true } },
          brand: true,
        },
      },
      subOrders: {
        include: {
          brand: true,
          items: { include: { product: true, brand: true } },
          statusLogs: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.json({ data: order });
});

router.get("/brand-dashboard", async (_req, res) => {
  const brands = await prisma.brand.findMany({
    include: {
      products: {
        orderBy: { createdAt: "desc" },
      },
      subOrders: {
        include: {
          order: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              statusLogs: { orderBy: { createdAt: "desc" } },
            },
          },
          items: {
            include: {
              product: true,
              brand: true,
            },
          },
          statusLogs: { orderBy: { createdAt: "desc" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = brands.map((brand) => {
    const orders = brand.subOrders
      .map((subOrder) => ({
        id: subOrder.order.id,
        subOrderId: subOrder.id,
        status: subOrder.status,
        paymentMethod: subOrder.order.paymentMethod,
        paymentStatus: subOrder.order.paymentStatus,
        trackingId: subOrder.trackingId,
        deliveryAttempts: subOrder.deliveryAttempts,
        failureReason: subOrder.failureReason,
        nextAttemptDate: subOrder.nextAttemptDate,
        finalDeliveryFailureAt: subOrder.finalDeliveryFailureAt,
        refundProcessedAt: subOrder.refundProcessedAt,
        subtotalPkr: subOrder.subtotalPkr,
        totalPkr: subOrder.order.totalPkr,
        createdAt: subOrder.createdAt,
        user: subOrder.order.user,
        statusLogs: subOrder.statusLogs,
        parentStatusLogs: subOrder.order.statusLogs,
        items: subOrder.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPricePkr: item.unitPricePkr,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            imageUrl: item.product.imageUrl,
          },
        })),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    const totalOrders = orders.length;
    const openOrders = orders.filter((order) => OPEN_ORDER_STATUSES.has(order.status)).length;
    const deliveredOrders = orders.filter((order) => order.status === "DELIVERED").length;
    const cancelledOrders = orders.filter((order) => order.status === "CANCELED").length;
    const totalSalesPkr = orders.reduce((sum, order) => sum + (order.status === "DELIVERED" ? order.subtotalPkr : 0), 0);
    const activeProducts = brand.products.filter((product) => product.isActive && product.approvalStatus === "APPROVED").length;
    const pendingProducts = brand.products.filter((product) => product.approvalStatus === "PENDING").length;
    const outOfStockProducts = brand.products.filter(
      (product) => product.isActive && product.approvalStatus === "APPROVED" && product.stock <= 0,
    ).length;

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        description: brand.description,
        verified: brand.verified,
        contactEmail: brand.contactEmail,
        whatsappNumber: brand.whatsappNumber,
        commissionRate: brand.commissionRate,
        apiEnabled: brand.apiEnabled,
        createdAt: brand.createdAt,
      },
      products: brand.products,
      orders,
      metrics: {
        totalProducts: brand.products.length,
        activeProducts,
        pendingProducts,
        outOfStockProducts,
        totalOrders,
        openOrders,
        deliveredOrders,
        cancelledOrders,
        totalSalesPkr,
        statusCounts,
      },
    };
  });

  return res.json({ data });
});

router.get("/brand-dashboard/:brandId", async (req, res) => {
  const brandId = String(req.params.brandId);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      products: { orderBy: { createdAt: "desc" } },
      subOrders: {
        include: {
          order: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              statusLogs: { orderBy: { createdAt: "desc" } },
            },
          },
          items: {
            include: {
              product: true,
              brand: true,
            },
          },
          statusLogs: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!brand) {
    return res.status(404).json({ message: "Brand not found" });
  }

  const orders = brand.subOrders
    .map((subOrder) => ({
      id: subOrder.order.id,
      subOrderId: subOrder.id,
      status: subOrder.status,
      paymentMethod: subOrder.order.paymentMethod,
      paymentStatus: subOrder.order.paymentStatus,
      trackingId: subOrder.trackingId,
      deliveryAttempts: subOrder.deliveryAttempts,
      failureReason: subOrder.failureReason,
      nextAttemptDate: subOrder.nextAttemptDate,
      finalDeliveryFailureAt: subOrder.finalDeliveryFailureAt,
      refundProcessedAt: subOrder.refundProcessedAt,
      subtotalPkr: subOrder.subtotalPkr,
      totalPkr: subOrder.order.totalPkr,
      createdAt: subOrder.createdAt,
      user: subOrder.order.user,
      statusLogs: subOrder.statusLogs,
      parentStatusLogs: subOrder.order.statusLogs,
      items: subOrder.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPricePkr: item.unitPricePkr,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          imageUrl: item.product.imageUrl,
        },
      })),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const totalOrders = orders.length;
  const openOrders = orders.filter((order) => OPEN_ORDER_STATUSES.has(order.status)).length;
  const deliveredOrders = orders.filter((order) => order.status === "DELIVERED").length;
  const cancelledOrders = orders.filter((order) => order.status === "CANCELED").length;
  const totalSalesPkr = orders.reduce((sum, order) => sum + (order.status === "DELIVERED" ? order.subtotalPkr : 0), 0);
  const activeProducts = brand.products.filter((product) => product.isActive && product.approvalStatus === "APPROVED").length;
  const pendingProducts = brand.products.filter((product) => product.approvalStatus === "PENDING").length;
  const outOfStockProducts = brand.products.filter(
    (product) => product.isActive && product.approvalStatus === "APPROVED" && product.stock <= 0,
  ).length;

  return res.json({
    data: {
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        description: brand.description,
        verified: brand.verified,
        contactEmail: brand.contactEmail,
        whatsappNumber: brand.whatsappNumber,
        commissionRate: brand.commissionRate,
        apiEnabled: brand.apiEnabled,
        createdAt: brand.createdAt,
      },
      products: brand.products,
      orders,
      metrics: {
        totalProducts: brand.products.length,
        activeProducts,
        pendingProducts,
        outOfStockProducts,
        totalOrders,
        openOrders,
        deliveredOrders,
        cancelledOrders,
        totalSalesPkr,
        statusCounts,
      },
    },
  });
});

export default router;
