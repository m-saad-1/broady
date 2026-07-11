import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function extractMatches(source, pattern) {
  const matches = [];
  for (const match of source.matchAll(pattern)) {
    matches.push(match[1]);
  }
  return matches;
}

function unique(values) {
  return Array.from(new Set(values));
}

async function main() {
  const seedText = fs.readFileSync(new URL("./seed.js", import.meta.url), "utf8");
  const verifyText = fs.readFileSync(new URL("./verify-crud.js", import.meta.url), "utf8");

  const demoBrandSlugs = unique([
    ...extractMatches(seedText, /slug:\s*"([^"]+)"/g).filter((slug) => ["outfitters", "breakout", "cougar"].includes(slug)),
    ...extractMatches(verifyText, /slug:\s*"([^"]+)"/g).filter((slug) => slug === "crud-test-brand"),
  ]);

  const demoProductSlugs = unique([
    ...extractMatches(seedText, /slug:\s*"([^"]+)"/g).filter((slug) => !["outfitters", "breakout", "cougar"].includes(slug)),
    ...extractMatches(verifyText, /slug:\s*"([^"]+)"/g).filter((slug) => slug === "crud-test-product"),
  ]);

  const demoUserEmails = unique([
    ...extractMatches(seedText, /email:\s*"([^"]+)"/g),
    ...extractMatches(verifyText, /email:\s*"([^"]+)"/g),
  ]);

  const [brands, products, users] = await Promise.all([
    prisma.brand.findMany({
      where: { slug: { in: demoBrandSlugs } },
      select: { id: true, slug: true },
    }),
    prisma.product.findMany({
      where: { slug: { in: demoProductSlugs } },
      select: { id: true, slug: true, brandId: true },
    }),
    prisma.user.findMany({
      where: { email: { in: demoUserEmails } },
      select: { id: true, email: true },
    }),
  ]);

  const brandIds = brands.map((item) => item.id);
  const productIds = products.map((item) => item.id);
  const userIds = users.map((item) => item.id);

  const orderItems = await prisma.orderItem.findMany({
    where: {
      OR: [
        { productId: { in: productIds } },
        { order: { userId: { in: userIds } } },
      ],
    },
    select: { orderId: true },
  });
  const orderIds = unique(orderItems.map((item) => item.orderId));

  const userActivities = await prisma.userActivity.findMany({
    where: {
      OR: [
        { productId: { in: productIds } },
        { userId: { in: userIds } },
      ],
    },
    select: { id: true },
  });
  const userActivityIds = userActivities.map((item) => item.id);

  console.log("Demo cleanup targets:");
  console.log(`- brands: ${brands.length}`);
  console.log(`- products: ${products.length}`);
  console.log(`- users: ${users.length}`);
  console.log(`- orders: ${orderIds.length}`);
  console.log(`- user activities: ${userActivityIds.length}`);

  await prisma.$transaction(async (tx) => {
    if (orderIds.length) {
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (userActivityIds.length) {
      await tx.userActivity.deleteMany({ where: { id: { in: userActivityIds } } });
    }

    if (productIds.length) {
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
    }

    if (userIds.length) {
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  const remainingBrandProducts = await prisma.product.groupBy({
    by: ["brandId"],
    where: { brandId: { in: brandIds } },
    _count: { brandId: true },
  });
  const brandIdsWithProducts = new Set(remainingBrandProducts.map((item) => item.brandId));
  const brandIdsToDelete = brandIds.filter((brandId) => !brandIdsWithProducts.has(brandId));

  if (brandIdsToDelete.length) {
    await prisma.brand.deleteMany({ where: { id: { in: brandIdsToDelete } } });
  }

  if (brandIds.length !== brandIdsToDelete.length) {
    const keptBrands = brands.filter((brand) => brandIdsWithProducts.has(brand.id)).map((brand) => brand.slug);
    console.log(`Kept brands with remaining products: ${keptBrands.join(", ") || "none"}`);
  }

  const [remainingBrands, remainingProducts, remainingUsers] = await Promise.all([
    prisma.brand.findMany({
      where: { slug: { in: demoBrandSlugs } },
      select: { slug: true },
    }),
    prisma.product.findMany({
      where: { slug: { in: demoProductSlugs } },
      select: { slug: true },
    }),
    prisma.user.findMany({
      where: { email: { in: demoUserEmails } },
      select: { email: true },
    }),
  ]);

  console.log(
    `Remaining demo rows after cleanup: brands=${remainingBrands.length}, products=${remainingProducts.length}, users=${remainingUsers.length}`,
  );

  console.log("Demo cleanup complete.");
}

main()
  .catch((error) => {
    console.error("Demo cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
