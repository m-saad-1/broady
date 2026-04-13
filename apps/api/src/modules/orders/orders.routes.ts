import { Router } from "express";
import { NotificationType, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { createNotificationWithChannels } from "../notifications/notification.service.js";

const router = Router();

const paymentMethodSchema = z.enum(["COD", "JAZZCASH", "EASYPAISA"]);
const brandOrderStatusSchema = z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELED", "CANCELLED"]);
const orderTransitionMap: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PACKED", "SHIPPED", "CANCELED"],
  PACKED: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

function normalizeStatus(status: z.infer<typeof brandOrderStatusSchema>): OrderStatus {
  return status === "CANCELLED" ? "CANCELED" : status;
}

function composeStatusNote(note?: string, trackingId?: string | null) {
  const parts: string[] = [];
  if (trackingId) parts.push(`Tracking ID: ${trackingId}`);
  if (note) parts.push(note);
  return parts.join(" | ") || undefined;
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

function formatOrderItemsSummary(
  items: Array<{ quantity: number; unitPricePkr: number; product: { name: string }; brand?: { name: string | null } | null }>,
) {
  return items
    .map((item) => `${item.quantity} x ${item.product.name} (${item.brand?.name || "Brand"}) @ PKR ${item.unitPricePkr.toLocaleString("en-PK")}`)
    .join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toHtmlMultiline(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br/>");
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

router.post("/", requireAuth, async (req, res) => {
  const schema = z.object({
    paymentMethod: paymentMethodSchema,
    deliveryAddress: z.string().min(10),
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().min(1),
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
          items: {
            create: parsed.data.items.map((item) => {
              const product = productById(item.productId);
              if (!product) {
                throw new Error("INVALID_PRODUCT");
              }
              return {
                productId: item.productId,
                brandId: product.brandId,
                quantity: item.quantity,
                unitPricePkr: product.pricePkr,
              };
            }),
          },
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          items: {
            include: { product: { include: { brand: true } }, brand: true },
          },
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: OrderStatus.PENDING,
          updatedBy: "SYSTEM",
          updatedById: req.auth!.userId,
          note: "Order placed by customer",
        },
      });

      const placedItemsSummary = formatOrderItemsSummary(created.items);
      const placedMessage = `Your order ${created.id} has been placed successfully on Broady.`;

      await createNotificationWithChannels({
        prismaClient: tx,
        type: NotificationType.ORDER_PLACED,
        title: "Your Broady Order Is Placed",
        message: placedMessage,
        userId: created.userId,
        orderId: created.id,
        emailRecipient:
          (await tx.notificationPreference.findUnique({
            where: { userId: created.userId },
            select: { orderUpdates: true },
          }))?.orderUpdates === false
            ? undefined
            : created.user.email,
        emailSubject: `Broady Order Confirmed: ${created.id}`,
        emailText: [
          `Hi ${created.user.fullName || "Customer"},`,
          "",
          placedMessage,
          "",
          `Total: PKR ${created.totalPkr.toLocaleString("en-PK")}`,
          `Payment: ${created.paymentMethod}`,
          "",
          "Items:",
          placedItemsSummary,
          "",
          `Delivery Address: ${created.deliveryAddress}`,
        ].join("\n"),
        emailHtml: `<p>Hi ${escapeHtml(created.user.fullName || "Customer")},</p><p>${escapeHtml(placedMessage)}</p><p><strong>Total:</strong> PKR ${created.totalPkr.toLocaleString("en-PK")}<br/><strong>Payment:</strong> ${escapeHtml(created.paymentMethod)}</p><p><strong>Items</strong><br/>${toHtmlMultiline(placedItemsSummary)}</p><p><strong>Delivery Address:</strong><br/>${toHtmlMultiline(created.deliveryAddress)}</p>`,
      });

      const uniqueBrandIds = Array.from(new Set(created.items.map((item) => item.brandId)));
      const brandMembers = await tx.brandMember.findMany({
        where: { brandId: { in: uniqueBrandIds } },
        include: {
          user: { select: { id: true, email: true } },
          brand: { select: { id: true, name: true, contactEmail: true, whatsappNumber: true } },
        },
      });

      for (const member of brandMembers) {
        const brandItems = created.items.filter((item) => item.brandId === member.brand.id);
        const brandItemsSummary = formatOrderItemsSummary(brandItems);
        const brandMessage = `You have a new order on Broady: order ${created.id} includes products from ${member.brand.name}.`;

        await createNotificationWithChannels({
          prismaClient: tx,
          type: NotificationType.BRAND_ORDER_ASSIGNED,
          title: "New Broady Order",
          message: brandMessage,
          userId: member.user.id,
          brandId: member.brand.id,
          orderId: created.id,
          emailRecipient: member.user.email || member.brand.contactEmail,
          whatsappRecipient: member.brand.whatsappNumber,
          emailSubject: `New Order Assigned: ${created.id}`,
          emailText: [
            `Brand: ${member.brand.name}`,
            brandMessage,
            "",
            `Customer: ${created.user.fullName || created.user.email || "N/A"}`,
            `Total (order): PKR ${created.totalPkr.toLocaleString("en-PK")}`,
            "",
            "Items for your brand:",
            brandItemsSummary,
          ].join("\n"),
          emailHtml: `<p><strong>Brand:</strong> ${escapeHtml(member.brand.name)}</p><p>${escapeHtml(brandMessage)}</p><p><strong>Customer:</strong> ${escapeHtml(created.user.fullName || created.user.email || "N/A")}<br/><strong>Total (order):</strong> PKR ${created.totalPkr.toLocaleString("en-PK")}</p><p><strong>Items for your brand</strong><br/>${toHtmlMultiline(brandItemsSummary)}</p>`,
          whatsappPayload: {
            orderId: created.id,
            brandId: member.brand.id,
            items: brandItems.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              unitPricePkr: item.unitPricePkr,
            })),
          },
        });
      }

      return created;
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

  return res.status(201).json({ data: order, paymentRedirect });
});

router.patch("/:orderId/status", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      status: brandOrderStatusSchema,
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
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  const status = normalizeStatus(parsed.data.status);
  const trackingId = parsed.data.trackingId ?? order.trackingId;
  const statusChanged = status !== order.status;
  const trackingChanged = trackingId !== order.trackingId;

  const actingAsPlatformAdmin = req.auth!.role === "ADMIN" || req.auth!.role === "SUPER_ADMIN";
  if (!actingAsPlatformAdmin) {
    const allowedBrands = new Set(await getAllowedBrandIdsForUser(req.auth!.userId, req.auth!.brandId));
    const touchesAnyOwnedBrand = order.items.some((item) => allowedBrands.has(item.brandId));
    if (!touchesAnyOwnedBrand) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  if (!actingAsPlatformAdmin && req.auth!.role !== "BRAND" && req.auth!.role !== "BRAND_ADMIN" && req.auth!.role !== "BRAND_STAFF") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (statusChanged && !orderTransitionMap[order.status].includes(status)) {
    return res.status(409).json({
      message: `Order status cannot move from ${order.status} to ${status}.`,
    });
  }

  if (!statusChanged && !trackingChanged && !parsed.data.note && !parsed.data.customerNote) {
    return res.json({ data: order });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        trackingId,
        paymentStatus:
          status === OrderStatus.DELIVERED && order.paymentMethod === "COD"
            ? PaymentStatus.COMPLETED
            : order.paymentStatus,
      },
      include: {
        items: { include: { product: true, brand: true } },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (status === OrderStatus.CANCELED && order.status !== OrderStatus.CANCELED) {
      await restockOrderItems(
        tx,
        nextOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
    }

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
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

    const notificationPreference = await tx.notificationPreference.findUnique({
      where: { userId: order.userId },
      select: { orderUpdates: true },
    });

    const statusMessage = `Broady updated order ${order.id} to ${status}${nextOrder.trackingId ? ` (Tracking: ${nextOrder.trackingId})` : ""}.`;
    const statusItemsSummary = formatOrderItemsSummary(nextOrder.items);

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.ORDER_STATUS_UPDATED,
      title: "Broady Order Update",
      message: statusMessage,
      userId: order.userId,
      orderId: order.id,
      emailRecipient: notificationPreference?.orderUpdates === false ? undefined : order.user.email,
      emailSubject: `Broady Order ${order.id}: ${status}`,
      emailText: [
        `Hi ${nextOrder.user.fullName || "Customer"},`,
        "",
        statusMessage,
        "",
        "Items:",
        statusItemsSummary,
        "",
        `Delivery Address: ${nextOrder.deliveryAddress}`,
      ].join("\n"),
      emailHtml: `<p>Hi ${escapeHtml(nextOrder.user.fullName || "Customer")},</p><p>${escapeHtml(statusMessage)}</p><p><strong>Items</strong><br/>${toHtmlMultiline(statusItemsSummary)}</p><p><strong>Delivery Address:</strong><br/>${toHtmlMultiline(nextOrder.deliveryAddress)}</p>`,
    });

    return nextOrder;
  });

  return res.json({ data: updated });
});

router.post("/me/:orderId/cancel", requireAuth, async (req, res) => {
  const payload = z
    .object({
      note: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body || {});

  if (!payload.success) {
    return res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: String(req.params.orderId),
      userId: req.auth!.userId,
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { product: true, brand: true } },
    },
  });

  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!([OrderStatus.PENDING, OrderStatus.CONFIRMED] as string[]).includes(order.status)) {
    return res.status(409).json({ message: "This order can no longer be canceled." });
  }

  const canceled = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELED },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: { include: { product: true, brand: true } },
      },
    });

    await restockOrderItems(
      tx,
      nextOrder.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    );

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CANCELED,
        updatedBy: "SYSTEM",
        updatedById: req.auth!.userId,
        note: composeStatusNote(payload.data.note || "Order canceled by customer"),
      },
    });

    const notificationPreference = await tx.notificationPreference.findUnique({
      where: { userId: order.userId },
      select: { orderUpdates: true },
    });

    const cancelMessage = `Your order ${order.id} has been canceled and stock was released back to inventory.`;
    const cancelItemsSummary = formatOrderItemsSummary(nextOrder.items);

    await createNotificationWithChannels({
      prismaClient: tx,
      type: NotificationType.ORDER_STATUS_UPDATED,
      title: "Broady Order Canceled",
      message: cancelMessage,
      userId: order.userId,
      orderId: order.id,
      emailRecipient: notificationPreference?.orderUpdates === false ? undefined : order.user.email,
      emailSubject: `Broady Order ${order.id} Canceled`,
      emailText: [
        `Hi ${nextOrder.user.fullName || "Customer"},`,
        "",
        cancelMessage,
        "",
        "Items:",
        cancelItemsSummary,
      ].join("\n"),
      emailHtml: `<p>Hi ${escapeHtml(nextOrder.user.fullName || "Customer")},</p><p>${escapeHtml(cancelMessage)}</p><p><strong>Items</strong><br/>${toHtmlMultiline(cancelItemsSummary)}</p>`,
    });

    const uniqueBrandIds = Array.from(new Set(nextOrder.items.map((item) => item.brandId)));
    const brandMembers = await tx.brandMember.findMany({
      where: { brandId: { in: uniqueBrandIds } },
      include: {
        user: { select: { id: true, email: true } },
        brand: { select: { id: true, name: true, contactEmail: true, whatsappNumber: true } },
      },
    });

    for (const member of brandMembers) {
      const brandItems = nextOrder.items.filter((item) => item.brandId === member.brand.id);
      const brandItemsSummary = formatOrderItemsSummary(brandItems);

      await createNotificationWithChannels({
        prismaClient: tx,
        type: NotificationType.ORDER_STATUS_UPDATED,
        title: "Order Canceled by Customer",
        message: `Order ${order.id} was canceled by the customer.`,
        userId: member.user.id,
        brandId: member.brand.id,
        orderId: order.id,
        emailRecipient: member.user.email || member.brand.contactEmail,
        whatsappRecipient: member.brand.whatsappNumber,
        emailSubject: `Order Canceled: ${order.id}`,
        emailText: [
          `Brand: ${member.brand.name}`,
          `Order ${order.id} was canceled by the customer.`,
          "",
          "Items for your brand:",
          brandItemsSummary,
        ].join("\n"),
        emailHtml: `<p><strong>Brand:</strong> ${escapeHtml(member.brand.name)}</p><p>${escapeHtml(`Order ${order.id} was canceled by the customer.`)}</p><p><strong>Items for your brand</strong><br/>${toHtmlMultiline(brandItemsSummary)}</p>`,
        whatsappPayload: {
          orderId: order.id,
          event: "ORDER_CANCELED_BY_CUSTOMER",
          brandId: member.brand.id,
          items: brandItems.map((item) => ({
            name: item.product.name,
            quantity: item.quantity,
            unitPricePkr: item.unitPricePkr,
          })),
        },
      });
    }

    return nextOrder;
  });

  return res.json({ data: canceled });
});

router.get("/me", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.auth!.userId },
    include: {
      items: { include: { product: true, brand: true } },
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
