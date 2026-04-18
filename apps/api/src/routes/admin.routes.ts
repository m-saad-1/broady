import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  listNotificationDeadLetters,
  purgeNotificationDeadLetter,
  purgeNotificationDeadLetters,
  requeueNotificationDeadLetter,
} from "../modules/notifications/notification.queue.js";
import { getNotificationWorkerStats } from "../modules/notifications/notification.worker.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/notifications/worker", async (_req, res) => {
  const stats = await getNotificationWorkerStats();
  return res.json({ data: stats });
});

router.get("/notifications/dead-letters", async (req, res) => {
  const parsedLimit = Number(req.query.limit);
  const parsedOffset = Number(req.query.offset);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 25;
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

  const data = await listNotificationDeadLetters(limit, offset);
  return res.json({ data });
});

router.post("/notifications/dead-letters/:jobId/requeue", async (req, res) => {
  const jobId = String(req.params.jobId);
  const requeued = await requeueNotificationDeadLetter(jobId);

  if (!requeued) {
    return res.status(404).json({ message: "Dead-letter job not found or not requeueable" });
  }

  return res.json({ data: { requeued: true, jobId } });
});

router.delete("/notifications/dead-letters/:jobId", async (req, res) => {
  const jobId = String(req.params.jobId);
  const deleted = await purgeNotificationDeadLetter(jobId);

  if (!deleted) {
    return res.status(404).json({ message: "Dead-letter job not found" });
  }

  return res.json({ data: { deleted: true, jobId } });
});

router.delete("/notifications/dead-letters", async (req, res) => {
  const confirm = String(req.query.confirm || "").trim();
  if (confirm !== "purge-dead-letters") {
    return res.status(400).json({
      message: "Bulk dead-letter purge requires confirm=purge-dead-letters",
    });
  }

  const limit = Number(req.query.limit || 100);
  const olderThanHours = Number(req.query.olderThanHours || 24);
  const clampedLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 100, 500));
  const clampedOlderThanHours = Math.max(Number.isFinite(olderThanHours) ? olderThanHours : 24, 1);
  const olderThanMs = clampedOlderThanHours * 60 * 60 * 1000;

  const purged = await purgeNotificationDeadLetters(clampedLimit, olderThanMs);
  return res.json({
    data: {
      purged,
      limit: clampedLimit,
      olderThanHours: clampedOlderThanHours,
    },
  });
});

router.get("/summary", async (_req, res) => {
  const [brandCount, productCount, orderCount] = await Promise.all([
    prisma.brand.count(),
    prisma.product.count(),
    prisma.order.count(),
  ]);

  return res.json({
    data: {
      brandCount,
      productCount,
      orderCount,
    },
  });
});

router.get("/orders", async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return res.json({ data: orders });
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
      orderItems: {
        include: {
          order: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              statusLogs: { orderBy: { createdAt: "desc" } },
            },
          },
          product: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = brands.map((brand: any) => {
    const orderMap = new Map<string, {
      id: string;
      status: string;
      paymentMethod: string;
      paymentStatus: string;
      trackingId: string | null;
      totalPkr: number;
      createdAt: Date;
      user: { id: string; fullName: string; email: string };
      statusLogs: Array<{
        id: string;
        status: string;
        updatedBy: string;
        updatedById: string | null;
        note: string | null;
        createdAt: Date;
      }>;
      items: Array<{
        id: string;
        quantity: number;
        unitPricePkr: number;
        createdAt: Date;
        product: {
          id: string;
          name: string;
          slug: string;
          imageUrl: string;
        };
      }>;
    }>();

    for (const item of brand.orderItems) {
      const existing = orderMap.get(item.orderId);
      const baseItem = {
        id: item.id,
        quantity: item.quantity,
        unitPricePkr: item.unitPricePkr,
        createdAt: item.createdAt,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          imageUrl: item.product.imageUrl,
        },
      };

      if (!existing) {
        orderMap.set(item.orderId, {
          id: item.order.id,
          status: item.order.status,
          paymentMethod: item.order.paymentMethod,
          paymentStatus: item.order.paymentStatus,
          trackingId: item.order.trackingId,
          totalPkr: item.order.totalPkr,
          createdAt: item.order.createdAt,
          user: item.order.user,
          statusLogs: item.order.statusLogs,
          items: [baseItem],
        });
        continue;
      }

      existing.items.push(baseItem);
    }

    const orders = Array.from(orderMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    const grossPkr = brand.orderItems.reduce((sum: number, item: any) => sum + item.quantity * item.unitPricePkr, 0);

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
        activeProducts: brand.products.filter((product: any) => product.isActive).length,
        pendingProducts: brand.products.filter((product: any) => product.approvalStatus === "PENDING").length,
        totalOrders: orders.length,
        grossPkr,
        statusCounts,
      },
    };
  });

  return res.json({ data });
});

router.get("/brand-dashboard/:brandId", async (req, res) => {
  const brandId = String(req.params.brandId);
  const dashboard = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      products: { orderBy: { createdAt: "desc" } },
      orderItems: {
        include: {
          order: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              statusLogs: { orderBy: { createdAt: "desc" } },
            },
          },
          product: true,
        },
      },
    },
  });

  if (!dashboard) {
    return res.status(404).json({ message: "Brand not found" });
  }

  return res.json({ data: dashboard });
});

export default router;
