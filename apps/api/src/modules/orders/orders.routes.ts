import { Router } from "express";
import { OrderStatus, PaymentStatus, Prisma, UserActivityEventType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { createUserAndIpRateLimiters } from "../../middleware/rate-limit.js";
import { addCartItem, getCart, getCartScopeFromUser, syncCheckoutCart } from "../carts/cart.service.js";
import { notificationEventNames } from "../notifications/notification.events.js";
import { queueNotificationEvent } from "../notifications/notification.service.js";
import { trackUserActivity } from "../recommendations/recommendation.service.js";

const router = Router();
const [orderPlacementIpLimit, orderPlacementUserLimit] = createUserAndIpRateLimiters("orders-create", 60_000, 10, 30);

const cancelReasonCodeSchema = z.enum([
  "CHANGED_MIND",
  "ORDERED_BY_MISTAKE",
  "FOUND_BETTER_PRICE",
  "DELIVERY_TOO_SLOW",
  "PAYMENT_ISSUE",
  "OTHER",
]);

const cancelReasonLabelByCode: Record<z.infer<typeof cancelReasonCodeSchema>, string> = {
  CHANGED_MIND: "Changed my mind",
  ORDERED_BY_MISTAKE: "Ordered by mistake",
  FOUND_BETTER_PRICE: "Found a better price",
  DELIVERY_TOO_SLOW: "Delivery is taking too long",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other",
};

const paymentMethodSchema = z.enum(["COD", "JAZZCASH", "EASYPAISA"]);
const brandOrderStatusSchema = z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELED", "CANCELLED"]);
const orderTransitionMap: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PACKED", "SHIPPED", "CANCELED"],
  PACKED: ["SHIPPED", "CANCELED"],
  PARTIALLY_SHIPPED: ["SHIPPED", "DELIVERED", "CANCELED"],
  SHIPPED: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

type OrderLifecycleEventName =
  | typeof notificationEventNames.orderPlaced
  | typeof notificationEventNames.orderConfirmed
  | typeof notificationEventNames.orderPacked
  | typeof notificationEventNames.orderShipped
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

const ORDER_ACTION_WINDOW_MS = 24 * 60 * 60 * 1000;

function isWithinOrderActionWindow(createdAt: Date) {
  return Date.now() - createdAt.getTime() <= ORDER_ACTION_WINDOW_MS;
}

function deriveParentOrderStatus(subOrderStatuses: OrderStatus[]): OrderStatus {
  if (subOrderStatuses.length === 0) return OrderStatus.PENDING;
  if (subOrderStatuses.every((status) => status === OrderStatus.CANCELED)) return OrderStatus.CANCELED;
  if (subOrderStatuses.every((status) => status === OrderStatus.DELIVERED)) return OrderStatus.DELIVERED;
  if (subOrderStatuses.every((status) => status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED)) return OrderStatus.SHIPPED;
  if (subOrderStatuses.some((status) => status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED)) {
    return OrderStatus.PARTIALLY_SHIPPED;
  }
  if (subOrderStatuses.every((status) => status === OrderStatus.CONFIRMED)) return OrderStatus.CONFIRMED;
  if (subOrderStatuses.some((status) => status === OrderStatus.PACKED)) return OrderStatus.PACKED;
  return OrderStatus.PENDING;
}

function buildSubOrderUpdateNote(status: OrderStatus, brandName: string, parentStatus: OrderStatus, explicitNote?: string) {
  if (explicitNote) return explicitNote;

  switch (status) {
    case OrderStatus.CONFIRMED:
      return `Your ${brandName} item has been confirmed.`;
    case OrderStatus.PACKED:
      return `Your ${brandName} item has been packed.`;
    case OrderStatus.SHIPPED:
      return `Your ${brandName} item has been shipped.`;
    case OrderStatus.DELIVERED:
      return parentStatus === OrderStatus.DELIVERED
        ? "Your order has been fully delivered."
        : `Your ${brandName} item has been delivered.`;
    case OrderStatus.CANCELED:
      return `Your ${brandName} item has been canceled.`;
    default:
      return `Your ${brandName} item status is now ${status.toLowerCase()}.`;
  }
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

  if (products.length !== parsed.data.items.length) {
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
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: parsed.data.paymentMethod === "COD" ? PaymentStatus.BRAND_COLLECTS_COD : PaymentStatus.HELD,
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
            status: OrderStatus.PENDING,
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

  // Integration point for JazzCash/Easypaisa checkout redirect or payment intent.
  const paymentRedirect =
    parsed.data.paymentMethod === "COD"
      ? null
      : `https://payments.example.com/${parsed.data.paymentMethod.toLowerCase()}/init/${order.id}`;

  queueNotificationEvent({
    name: notificationEventNames.orderPlaced,
    orderId: order.id,
    userId: order.userId,
    changedByRole: "USER",
  });

  if (parsed.data.paymentMethod !== "COD") {
    queueNotificationEvent({
      name: notificationEventNames.paymentInitiated,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: parsed.data.paymentMethod,
    });
  }

  await Promise.allSettled(
    parsed.data.items.map(async (item) => {
      const product = productById(item.productId);
      if (!product) return;

      await trackUserActivity({
        userId: req.auth!.userId,
        eventType: UserActivityEventType.PRODUCT_PURCHASED,
        productId: product.id,
        topCategory: product.topCategory,
        subCategory: product.subCategory,
        metadata: {
          quantity: item.quantity,
          orderId: order.id,
        },
      });
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

  return res.status(201).json({ data: order, paymentRedirect });
});

router.patch("/:orderId/status", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      status: brandOrderStatusSchema,
      subOrderId: z.string().trim().min(3).optional(),
      vendorGroupId: z.string().trim().min(3).optional(),
      trackingId: z.string().trim().min(4).max(120).optional(),
      note: z.string().trim().max(240).optional(),
      customerNote: z.string().trim().max(240).optional(),
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

  if (!statusChanged && !trackingChanged && !parsed.data.note && !parsed.data.customerNote) {
    return res.json({ data: order });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.subOrder.update({
      where: { id: targetSubOrder.id },
      data: {
        status,
        trackingId,
      },
    });

    if (status === OrderStatus.CANCELED && targetSubOrder.status !== OrderStatus.CANCELED) {
      await restockOrderItems(
        tx,
        targetSubOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
    }

    await tx.subOrderStatusLog.create({
      data: {
        subOrderId: targetSubOrder.id,
        status,
        updatedBy: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
        updatedById: req.auth!.userId,
        note: buildStatusLogNote({
          internalNote: parsed.data.note,
          trackingId: trackingChanged ? trackingId : undefined,
          customerNote: parsed.data.customerNote,
        }),
      },
    });

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

    const nextPaymentStatus =
      nextParentStatus === OrderStatus.DELIVERED && order.paymentMethod === "COD"
        ? PaymentStatus.COMPLETED
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
          internalNote: parsed.data.note
            ? `Vendor group (${targetSubOrder.brand.name}) update: ${parsed.data.note}`
            : `Vendor group (${targetSubOrder.brand.name}) updated to ${status}`,
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

  const orderEventByStatus: Record<OrderStatus, OrderLifecycleEventName> = {
    PENDING: notificationEventNames.orderPlaced,
    CONFIRMED: notificationEventNames.orderConfirmed,
    PACKED: notificationEventNames.orderPacked,
    PARTIALLY_SHIPPED: notificationEventNames.orderShipped,
    SHIPPED: notificationEventNames.orderShipped,
    DELIVERED: notificationEventNames.orderDelivered,
    CANCELED: notificationEventNames.orderCancelled,
  };

  const parentStatusAfterUpdate = updated.status;

  const customerFacingNote = buildSubOrderUpdateNote(
    status,
    targetSubOrder.brand.name,
    parentStatusAfterUpdate,
    parsed.data.customerNote,
  );

  if (statusChanged) {
    queueNotificationEvent({
      name: orderEventByStatus[status],
      orderId: order.id,
      subOrderId: targetSubOrder.id,
      userId: order.userId,
      brandId: targetSubOrder.brandId,
      brandName: targetSubOrder.brand.name,
      changedByRole: actingAsPlatformAdmin ? "ADMIN" : "BRAND",
      note: customerFacingNote,
      notifyAdmin: true,
    });
  }

  if (status === OrderStatus.DELIVERED && order.paymentMethod === "COD" && order.paymentStatus !== PaymentStatus.COMPLETED) {
    queueNotificationEvent({
      name: notificationEventNames.paymentSuccess,
      orderId: order.id,
      userId: order.userId,
      paymentMethod: order.paymentMethod,
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

  if (!isWithinOrderActionWindow(order.createdAt)) {
    return res.status(409).json({ message: "Cancel window has expired for this order." });
  }

  const blockingStatuses: OrderStatus[] = [OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED];
  if (order.subOrders.some((subOrder) => blockingStatuses.includes(subOrder.status))) {
    return res.status(409).json({ message: "This order can no longer be canceled." });
  }

  const canceled = await prisma.$transaction(async (tx) => {
    await tx.subOrder.updateMany({
      where: {
        orderId: order.id,
        status: { not: OrderStatus.CANCELED },
      },
      data: { status: OrderStatus.CANCELED },
    });

    const activeItems = order.subOrders
      .filter((subOrder) => subOrder.status !== OrderStatus.CANCELED)
      .flatMap((subOrder) => subOrder.items)
      .map((item) => ({ productId: item.productId, quantity: item.quantity }));

    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELED },
    });

    await restockOrderItems(
      tx,
      activeItems,
    );

    for (const subOrder of order.subOrders) {
      if (subOrder.status === OrderStatus.CANCELED) continue;
      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: subOrder.id,
          status: OrderStatus.CANCELED,
          updatedBy: "SYSTEM",
          updatedById: req.auth!.userId,
          note: composeStatusNote(cancellationReason || "Vendor group canceled by customer"),
        },
      });
    }

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CANCELED,
        updatedBy: "SYSTEM",
        updatedById: req.auth!.userId,
        note: composeStatusNote(cancellationReason || "Order canceled by customer"),
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
    userId: order.userId,
    changedByRole: "USER",
    note: cancellationReason,
    notifyAdmin: false,
  });

  for (const subOrder of order.subOrders.filter((entry) => entry.status !== OrderStatus.CANCELED)) {
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

  return res.json({ data: canceled });
});

router.post("/me/:orderId/sub-orders/:subOrderId/cancel", requireAuth, async (req, res) => {
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
      subOrders: {
        include: {
          brand: true,
          items: true,
        },
      },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!isWithinOrderActionWindow(order.createdAt)) {
    return res.status(409).json({ message: "Cancel window has expired for this order." });
  }

  const targetSubOrder = order.subOrders.find((subOrder) => subOrder.id === String(req.params.subOrderId));
  if (!targetSubOrder) {
    return res.status(404).json({ message: "Vendor group not found" });
  }

  if (["PACKED", "SHIPPED", "DELIVERED"].includes(targetSubOrder.status)) {
    return res.status(409).json({ message: "This vendor group can no longer be canceled." });
  }

  const canceled = await prisma.$transaction(async (tx) => {
    if (targetSubOrder.status !== OrderStatus.CANCELED) {
      await tx.subOrder.update({
        where: { id: targetSubOrder.id },
        data: { status: OrderStatus.CANCELED },
      });

      await restockOrderItems(
        tx,
        targetSubOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: targetSubOrder.id,
          status: OrderStatus.CANCELED,
          updatedBy: "SYSTEM",
          updatedById: req.auth!.userId,
          note: composeStatusNote(cancellationReason || "Vendor group canceled by customer"),
        },
      });
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
        updatedBy: "SYSTEM",
        updatedById: req.auth!.userId,
        note: composeStatusNote(cancellationReason || `Vendor group (${targetSubOrder.brand.name}) canceled by customer`),
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

  return res.json({ data: canceled });
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
    (subOrder) => subOrder.status === OrderStatus.DELIVERED || subOrder.status === OrderStatus.CANCELED,
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

  if (!["DELIVERED", "CANCELED"].includes(targetSubOrder.status)) {
    return res.status(409).json({ message: "Reorder is available only for delivered or canceled vendor groups." });
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
        },
        orderBy: { createdAt: "asc" },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({
    data: orders.map((order) => ({
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
        },
        orderBy: { createdAt: "asc" },
      },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  return res.json({
    data: {
      ...order,
      statusLogs: order.statusLogs.map((log) => ({
        ...log,
        note: extractCustomerVisibleNote(log.note) || (log.updatedBy === "SYSTEM" ? log.note : null),
      })),
    },
  });
});

export default router;
