const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const customerEmail = "saadedits95@gmail.com";
  const brandEmail = "muhammadsaad23305@gmail.com";

  const brandCandidates = await prisma.brand.findMany({
    where: {
      OR: [
        { name: { contains: "Outfitters", mode: "insensitive" } },
        { name: { contains: "Breakout", mode: "insensitive" } },
        { contactEmail: brandEmail },
      ],
    },
    select: { id: true, name: true, slug: true, contactEmail: true },
    orderBy: { name: "asc" },
  });

  const customer = await prisma.user.findUnique({
    where: { email: customerEmail },
    select: { id: true, email: true, fullName: true, role: true },
  });

  const targetBrand = await prisma.brand.findFirst({
    where: {
      OR: [
        { contactEmail: brandEmail },
        { name: { equals: "Outfitters", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, contactEmail: true, whatsappNumber: true },
  });

  if (!customer) {
    console.log(JSON.stringify({ error: "customer_not_found", customerEmail }, null, 2));
    return;
  }

  if (!targetBrand) {
    console.log(JSON.stringify({ error: "brand_not_found", brandEmail }, null, 2));
    return;
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: customer.id,
      items: {
        some: {
          brandId: targetBrand.id,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      subOrders: {
        select: {
          id: true,
          brandId: true,
          status: true,
          createdAt: true,
          brand: { select: { id: true, name: true, contactEmail: true } },
        },
      },
    },
  });

  const recentCustomerOrders = await prisma.order.findMany({
    where: { userId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      items: {
        select: {
          brand: { select: { id: true, name: true, contactEmail: true } },
          quantity: true,
        },
      },
    },
  });

  const orderIds = orders.map((o) => o.id);

  const notifications = orderIds.length
    ? await prisma.notification.findMany({
        where: { orderId: { in: orderIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderId: true,
          userId: true,
          brandId: true,
          type: true,
          title: true,
          message: true,
          createdAt: true,
          user: { select: { email: true } },
          brand: { select: { name: true, contactEmail: true } },
          channelLogs: {
            select: {
              channel: true,
              status: true,
              recipient: true,
              error: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : [];

  const summaryByOrder = orderIds.map((orderId) => {
    const orderNotifications = notifications.filter((n) => n.orderId === orderId);
    const emailLogs = orderNotifications.flatMap((n) =>
      n.channelLogs
        .filter((c) => c.channel === "EMAIL")
        .map((c) => ({
          notificationId: n.id,
          title: n.title,
          userEmail: n.user?.email || null,
          brandName: n.brand?.name || null,
          recipient: c.recipient,
          status: c.status,
          error: c.error,
          createdAt: c.createdAt,
        })),
    );

    return {
      orderId,
      totalNotifications: orderNotifications.length,
      emailLogs,
      hasCustomerEmailLog: emailLogs.some((e) => e.recipient?.toLowerCase() === customerEmail),
      hasBrandEmailLog: emailLogs.some((e) => e.recipient?.toLowerCase() === brandEmail),
      customerEmailStatuses: emailLogs
        .filter((e) => e.recipient?.toLowerCase() === customerEmail)
        .map((e) => e.status),
      brandEmailStatuses: emailLogs
        .filter((e) => e.recipient?.toLowerCase() === brandEmail)
        .map((e) => e.status),
    };
  });

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        customer,
        brandCandidates,
        targetBrand,
        matchedOrdersCount: orders.length,
        orders,
        recentCustomerOrders,
        summaryByOrder,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
