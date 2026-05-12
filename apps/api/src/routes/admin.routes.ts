import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

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
