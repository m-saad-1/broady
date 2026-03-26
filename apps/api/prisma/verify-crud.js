import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Prisma CRUD verification...");

  const brand = await prisma.brand.upsert({
    where: { slug: "crud-test-brand" },
    update: { name: "CRUD Test Brand" },
    create: {
      name: "CRUD Test Brand",
      slug: "crud-test-brand",
      description: "Temporary brand used for database verification",
      verified: true,
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: "crud-test-product" },
    update: {
      stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
    },
    create: {
      brandId: brand.id,
      name: "CRUD Test Product",
      slug: "crud-test-product",
      description: "Temporary product used for database verification",
      pricePkr: 2500,
      topCategory: "Men",
      subCategory: "Clothing",
      sizes: ["M", "L"],
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
      stock: 10,
      isActive: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "crud-test@broady.local" },
    update: { fullName: "CRUD Test User" },
    create: {
      email: "crud-test@broady.local",
      fullName: "CRUD Test User",
      password: "$2a$12$Qqv7j6mL0P3prwQZ9x3Y2enB4qKkoqKj8LhQ8mGvY1K9fI8Q2xYVO",
      authProvider: "LOCAL",
      role: "USER",
    },
  });

  const cart = await prisma.cart.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const cartItem = await prisma.cartItem.upsert({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: product.id,
      },
    },
    update: { quantity: 2 },
    create: {
      cartId: cart.id,
      productId: product.id,
      quantity: 1,
    },
  });

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      paymentMethod: "COD",
      totalPkr: product.pricePkr * cartItem.quantity,
      deliveryAddress: "123 Test Street, Lahore",
      items: {
        create: [
          {
            productId: product.id,
            quantity: cartItem.quantity,
            unitPricePkr: product.pricePkr,
          },
        ],
      },
    },
    include: { items: true },
  });

  const fetchedOrder = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: true, user: true },
  });

  await prisma.cartItem.update({
    where: { id: cartItem.id },
    data: { quantity: 3 },
  });

  await prisma.order.delete({ where: { id: order.id } });

  console.log("CRUD verification complete.");
  console.log(
    JSON.stringify(
      {
        brandId: brand.id,
        productId: product.id,
        userId: user.id,
        cartId: cart.id,
        fetchedOrderId: fetchedOrder.id,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("CRUD verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
