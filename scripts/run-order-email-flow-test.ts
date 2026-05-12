import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductApprovalStatus,
  PrismaClient,
} from "@prisma/client";
import { emitNotificationEvent } from "../apps/api/src/modules/notifications/notification.service.js";
import { notificationEventNames } from "../apps/api/src/modules/notifications/notification.events.js";

const prisma = new PrismaClient();

async function main() {
  const customerEmail = "saadedits95@gmail.com";
  const brandEmail = "muhammadsaad23305@gmail.com";

  const customer = await prisma.user.findUnique({
    where: { email: customerEmail },
    select: { id: true, email: true, fullName: true },
  });

  if (!customer) {
    throw new Error(`Customer not found: ${customerEmail}`);
  }

  const outfitters = await prisma.brand.findFirst({
    where: {
      name: { equals: "Outfitters", mode: "insensitive" },
    },
    select: { id: true, name: true, contactEmail: true },
  });

  if (!outfitters) {
    throw new Error("Outfitters brand not found");
  }

  const product = await prisma.product.findFirst({
    where: {
      brandId: outfitters.id,
      isActive: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
      stock: { gt: 0 },
    },
    select: {
      id: true,
      brandId: true,
      name: true,
      pricePkr: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!product) {
    throw new Error("No active approved Outfitters product with stock found");
  }

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: customer.id,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
        totalPkr: product.pricePkr,
        deliveryAddress: "TEST ORDER - EMAIL FLOW VERIFICATION",
      },
      select: { id: true, userId: true },
    });

    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        brandId: product.brandId,
        quantity: 1,
        unitPricePkr: product.pricePkr,
      },
    });

    const subOrder = await tx.subOrder.create({
      data: {
        orderId: order.id,
        brandId: outfitters.id,
        status: OrderStatus.PENDING,
        subtotalPkr: product.pricePkr,
      },
      select: { id: true },
    });

    return { orderId: order.id, subOrderId: subOrder.id };
  });

  await emitNotificationEvent({
    name: notificationEventNames.orderPlaced,
    orderId: created.orderId,
    userId: customer.id,
    changedByRole: "USER",
  });

  await emitNotificationEvent({
    name: notificationEventNames.orderConfirmed,
    orderId: created.orderId,
    subOrderId: created.subOrderId,
    userId: customer.id,
    changedByRole: "SYSTEM",
    note: "COD order auto-confirmed.",
    brandId: outfitters.id,
    brandName: outfitters.name,
    notifyAdmin: true,
  });

  const notifications = await prisma.notification.findMany({
    where: { orderId: created.orderId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      user: { select: { email: true } },
      brand: { select: { name: true, contactEmail: true } },
      channelLogs: {
        orderBy: { createdAt: "asc" },
        select: {
          channel: true,
          status: true,
          recipient: true,
          error: true,
          createdAt: true,
        },
      },
    },
  });

  const emailLogs = notifications.flatMap((n) =>
    n.channelLogs
      .filter((c) => c.channel === "EMAIL")
      .map((c) => ({
        notificationId: n.id,
        title: n.title,
        userEmail: n.user?.email ?? null,
        brandName: n.brand?.name ?? null,
        brandContactEmail: n.brand?.contactEmail ?? null,
        recipient: c.recipient,
        status: c.status,
        error: c.error,
        createdAt: c.createdAt,
      })),
  );

  const output = {
    checkedAt: new Date().toISOString(),
    testOrder: {
      orderId: created.orderId,
      subOrderId: created.subOrderId,
      customerEmail,
      expectedBrandEmail: brandEmail,
      outfittersContactEmail: outfitters.contactEmail,
      product: {
        id: product.id,
        name: product.name,
      },
    },
    notificationsCount: notifications.length,
    emailLogs,
    assertions: {
      hasCustomerEmailLog: emailLogs.some((e) => e.recipient.toLowerCase() === customerEmail.toLowerCase()),
      hasBrandEmailLog: emailLogs.some((e) => e.recipient.toLowerCase() === brandEmail.toLowerCase()),
      customerStatuses: emailLogs
        .filter((e) => e.recipient.toLowerCase() === customerEmail.toLowerCase())
        .map((e) => e.status),
      brandStatuses: emailLogs
        .filter((e) => e.recipient.toLowerCase() === brandEmail.toLowerCase())
        .map((e) => e.status),
      failedEmailErrors: emailLogs
        .filter((e) => e.status === "FAILED")
        .map((e) => ({ recipient: e.recipient, error: e.error })),
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
