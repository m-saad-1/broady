import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  console.log("Starting stock update script...");

  // 1. Fetch all products and their variants
  const products = await prisma.product.findMany({
    include: {
      variants: true
    }
  });

  console.log(`Found ${products.length} products to update.`);

  let updatedProductsCount = 0;
  let updatedVariantsCount = 0;
  let updatedInventoriesCount = 0;

  for (const product of products) {
    // Update product stock and availability status
    await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: 100,
        availabilityStatus: "IN_STOCK"
      }
    });
    updatedProductsCount++;

    if (product.variants.length > 0) {
      for (const variant of product.variants) {
        // Update variant stock status
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            stockStatus: "in_stock"
          }
        });
        updatedVariantsCount++;

        // Upsert inventory for the variant
        await prisma.inventory.upsert({
          where: {
            productId_sku: {
              productId: product.id,
              sku: variant.sku
            }
          },
          update: {
            quantity: 100,
            available: 100,
            reserved: 0,
            syncState: "IDLE"
          },
          create: {
            productId: product.id,
            variantId: variant.id,
            sku: variant.sku,
            quantity: 100,
            available: 100,
            reserved: 0,
            syncState: "IDLE"
          }
        });
        updatedInventoriesCount++;
      }
    } else {
      // Product has no variants: upsert product-level inventory record
      const existingInventory = await prisma.inventory.findFirst({
        where: { productId: product.id }
      });

      const sku = existingInventory?.sku || `${product.slug || product.id}-stock`;

      await prisma.inventory.upsert({
        where: {
          productId_sku: {
            productId: product.id,
            sku: sku
          }
        },
        update: {
          quantity: 100,
          available: 100,
          reserved: 0,
          syncState: "IDLE"
        },
        create: {
          productId: product.id,
          sku: sku,
          quantity: 100,
          available: 100,
          reserved: 0,
          syncState: "IDLE"
        }
      });
      updatedInventoriesCount++;
    }
  }

  console.log(` Stock update complete:`);
  console.log(`- Updated ${updatedProductsCount} products to stock=100, availabilityStatus=IN_STOCK`);
  console.log(`- Updated ${updatedVariantsCount} variants to stockStatus=in_stock`);
  console.log(`- Upserted ${updatedInventoriesCount} inventory records to quantity=100, available=100`);

  // 2. Invalidate Redis Caches
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  console.log(`Connecting to Redis at ${redisUrl} to flush caches...`);
  try {
    const redis = new Redis(redisUrl);
    
    // Bump product cache version
    await redis.incr("products:version");
    console.log("Bumped product cache version ('products:version').");

    // Scan and delete key patterns like product:* and products:*
    const keysToDel = [];
    
    const productKeys = await redis.keys("product:*");
    if (productKeys.length > 0) keysToDel.push(...productKeys);

    const productsKeys = await redis.keys("products:*");
    if (productsKeys.length > 0) keysToDel.push(...productsKeys);

    if (keysToDel.length > 0) {
      await redis.del(...keysToDel);
      console.log(`Cleared ${keysToDel.length} product/products keys from Redis cache.`);
    }

    await redis.quit();
  } catch (redisError) {
    console.warn("Failed to invalidate Redis cache, but DB updates were successful:", redisError.message);
  }
}

main()
  .catch((err) => {
    console.error("Error updating stock:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
