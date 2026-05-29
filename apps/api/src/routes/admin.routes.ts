import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { notificationEventNames } from "../modules/notifications/notification.events.js";
import { queueNotificationEvent } from "../modules/notifications/notification.service.js";
import { runShippingAutomationSweep } from "../modules/orders/shippingAutomation.service.js";

const router = Router();
const OPEN_ORDER_STATUSES = new Set(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"]);

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
      returnStatus: z.enum(["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "PICKUP_SCHEDULED", "IN_TRANSIT", "RECEIVED", "REFUND_INITIATED", "COMPLETED"]).optional(),
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
        subOrder: { select: { id: true, brandId: true, subtotalPkr: true, status: true } },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.returnRequest.findMany({
      where: { status: query.data.returnStatus },
      include: {
        order: { select: { id: true, userId: true, paymentMethod: true } },
        subOrder: { select: { id: true, brandId: true, subtotalPkr: true, status: true } },
        statusLogs: { orderBy: { createdAt: "desc" } },
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
      returnRequests,
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

router.patch("/refund-requests/:refundRequestId/status", async (req, res) => {
  const payload = z
    .object({
      status: z.enum(["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED"]),
      note: z.string().trim().max(500).optional(),
      method: z.enum(["ORIGINAL_SOURCE", "BANK_TRANSFER", "WALLET_CREDIT"]).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const db = prisma as any;
  const refundRequest = await db.refundRequest.findUnique({
    where: { id: String(req.params.refundRequestId) },
    include: { order: true, subOrder: true },
  });
  if (!refundRequest) return res.status(404).json({ message: "Refund request not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.refundRequest.update({
      where: { id: refundRequest.id },
      data: {
        status: payload.data.status,
        reviewNote: payload.data.note?.trim() || refundRequest.reviewNote,
        method: payload.data.method || refundRequest.method,
        completedAt: payload.data.status === "COMPLETED" ? new Date() : refundRequest.completedAt,
      },
    });
    await dbTx.refundStatusLog.create({
      data: {
        refundRequestId: refundRequest.id,
        status: payload.data.status,
        updatedBy: "ADMIN",
        updatedById: req.auth!.userId,
        note: payload.data.note?.trim() || undefined,
      },
    });
    if (payload.data.status === "COMPLETED") {
      await tx.subOrder.update({
        where: { id: refundRequest.subOrderId },
        data: { refundProcessedAt: new Date() },
      });
    }
    return next;
  });

  queueNotificationEvent({
    name: notificationEventNames.refundStateUpdated,
    orderId: refundRequest.orderId,
    userId: refundRequest.order.userId,
    brandId: refundRequest.subOrder.brandId,
    paymentMethod: refundRequest.order.paymentMethod,
    reason: `Refund is now ${payload.data.status}${payload.data.note ? `: ${payload.data.note}` : ""}`,
  });

  if (payload.data.status === "COMPLETED") {
    queueNotificationEvent({
      name: notificationEventNames.refundProcessed,
      orderId: refundRequest.orderId,
      userId: refundRequest.order.userId,
      paymentMethod: refundRequest.order.paymentMethod,
      reason: payload.data.note,
    });
  }

  return res.json({ data: updated });
});

router.patch("/return-requests/:returnRequestId/status", async (req, res) => {
  const payload = z
    .object({
      status: z.enum(["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "PICKUP_SCHEDULED", "IN_TRANSIT", "RECEIVED", "REFUND_INITIATED", "COMPLETED"]),
      note: z.string().trim().max(500).optional(),
      pickupTracking: z.string().trim().max(160).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const db = prisma as any;
  const returnRequest = await db.returnRequest.findUnique({
    where: { id: String(req.params.returnRequestId) },
    include: { order: true, subOrder: true },
  });
  if (!returnRequest) return res.status(404).json({ message: "Return request not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const dbTx = tx as any;
    const next = await dbTx.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: payload.data.status,
        reviewNote: payload.data.note?.trim() || returnRequest.reviewNote,
        pickupTracking: payload.data.pickupTracking || returnRequest.pickupTracking,
      },
    });
    await dbTx.returnStatusLog.create({
      data: {
        returnRequestId: returnRequest.id,
        status: payload.data.status,
        updatedBy: "ADMIN",
        updatedById: req.auth!.userId,
        note: payload.data.note?.trim() || undefined,
      },
    });
    if (payload.data.status === "RECEIVED" || payload.data.status === "REFUND_INITIATED") {
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
            requestedByRole: "SYSTEM",
            reasonCode: "RETURNED_PRODUCT",
            method: returnRequest.order.paymentMethod === "COD" ? "BANK_TRANSFER" : "ORIGINAL_SOURCE",
            amountPkr: returnRequest.subOrder.subtotalPkr,
            status: "PENDING",
            reviewNote: "Auto-created from return workflow.",
          },
        });
        await dbTx.refundStatusLog.create({
          data: {
            refundRequestId: refundRequest.id,
            status: "PENDING",
            updatedBy: "SYSTEM",
            note: "Auto-created after return received.",
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
    userId: returnRequest.order.userId,
    brandId: returnRequest.subOrder.brandId,
    note: `Return is now ${payload.data.status}${payload.data.note ? `: ${payload.data.note}` : ""}`,
    changedByRole: "ADMIN",
    notifyAdmin: true,
  });

  if (payload.data.status === "COMPLETED") {
    await prisma.subOrder.update({
      where: { id: returnRequest.subOrderId },
      data: { status: "RETURNED" },
    });
  }

  return res.json({ data: updated });
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
