import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking product database stock...");

  const productCount = await prisma.product.count();
  console.log(`Total products: ${productCount}`);

  // Count by availability status
  const outOfStockCount = await prisma.product.count({
    where: { availabilityStatus: "OUT_OF_STOCK" }
  });
  const inStockCount = await prisma.product.count({
    where: { availabilityStatus: "IN_STOCK" }
  });
  const lowStockCount = await prisma.product.count({
    where: { availabilityStatus: "LOW_STOCK" }
  });
  console.log(`Products status: IN_STOCK=${inStockCount}, OUT_OF_STOCK=${outOfStockCount}, LOW_STOCK=${lowStockCount}`);

  // Count by stock field
  const zeroStockCount = await prisma.product.count({
    where: { stock: 0 }
  });
  const nonZeroStockCount = await prisma.product.count({
    where: { stock: { gt: 0 } }
  });
  console.log(`Products with stock=0: ${zeroStockCount}, stock>0: ${nonZeroStockCount}`);

  // Check ProductVariant counts
  const variantCount = await prisma.productVariant.count();
  console.log(`Total variants: ${variantCount}`);

  const outOfStockVariants = await prisma.productVariant.count({
    where: { stockStatus: "out_of_stock" }
  });
  const inStockVariants = await prisma.productVariant.count({
    where: { stockStatus: "in_stock" }
  });
  console.log(`Variants status: in_stock=${inStockVariants}, out_of_stock=${outOfStockVariants}`);

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

  // Fetch a sample product that has variants
  const sample = await prisma.product.findFirst({
    where: {
      variants: {
        some: {}
      }
    },
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
    console.log("Sample Product with variants:", JSON.stringify({
      id: sample.id,
      name: sample.name,
      slug: sample.slug,
      stock: sample.stock,
      availabilityStatus: sample.availabilityStatus,
      variants: sample.variants.map(v => ({
        id: v.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        stockStatus: v.stockStatus,
        inventory: v.inventory ? {
          quantity: v.inventory.quantity,
          available: v.inventory.available,
          reserved: v.inventory.reserved
        } : null
      }))
    }, null, 2));
  } else {
    console.log("No sample product with variants found");
    // Get any sample product
    const anySample = await prisma.product.findFirst({
      include: {
        inventoryRecords: true
      }
    });
    if (anySample) {
      console.log("Sample Product without variants:", JSON.stringify({
        id: anySample.id,
        name: anySample.name,
        stock: anySample.stock,
        availabilityStatus: anySample.availabilityStatus,
        inventoryRecords: anySample.inventoryRecords
      }, null, 2));
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
