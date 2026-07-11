import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking product database stock...");

  const productCount = await prisma.product.count();
  console.log(`Total products: ${productCount}`);

  // count by availability status
  const outOfStockCount = await prisma.product.count({
    where: { availabilityStatus: "OUT_OF_STOCK" }
  });
  const inStockCount = await prisma.product.count({
    where: { availabilityStatus: "IN_STOCK" }
  });
  console.log(`Products status: IN_STOCK=${inStockCount}, OUT_OF_STOCK=${outOfStockCount}`);

  // Count by stock field
  const zeroStockCount = await prisma.product.count({
    where: { stock: 0 }
  });
  console.log(`Products with stock=0: ${zeroStockCount}`);

  // Check ProductVariant counts
  const variantCount = await prisma.productVariant.count();
  console.log(`Total variants: ${variantCount}`);

  const activeVariants = await prisma.productVariant.count({
    where: { isActive: true }
  });
  console.log(`Active variants: ${activeVariants}`);

  const outOfStockVariants = await prisma.productVariant.count({
    where: { stockStatus: "out_of_stock" }
  });
  console.log(`Variants status: out_of_stock=${outOfStockVariants}`);

  // Check Inventory records
  const inventoryCount = await prisma.inventory.count();
  console.log(`Total inventory records: ${inventoryCount}`);

  const zeroInventoryCount = await prisma.inventory.count({
    where: { quantity: 0 }
  });
  const zeroAvailableInventory = await prisma.inventory.count({
    where: { available: 0 }
  });
  console.log(`Inventory with quantity=0: ${zeroInventoryCount}, available=0: ${zeroAvailableInventory}`);

  // Let's print a sample product with its variants and inventory if any exist
  const sample = await prisma.product.findFirst({
    include: {
      variants: {
        include: {
          inventory: true
        }
      },
      inventoryRecords: true
    }
  });

  if (sample) {
    console.log("Sample Product:", JSON.stringify(sample, null, 2));
  } else {
    console.log("No sample product found");
  }
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
