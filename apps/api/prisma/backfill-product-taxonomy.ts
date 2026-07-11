import { PrismaClient } from "@prisma/client";
import { classifyProduct } from "../src/modules/products/classification.service.ts";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      gender: true,
      topCategory: true,
      subCategory: true,
      type: true,
      tags: true,
      productUrl: true,
      stock: true,
      isActive: true,
    },
  });

  for (const product of products) {
    const classification = await classifyProduct({
      title: product.name,
      description: product.description,
      url: product.productUrl || undefined,
      breadcrumbs: [product.gender, product.topCategory, product.subCategory, product.type].filter(Boolean) as string[],
      brandCategory: product.type || product.topCategory || undefined,
      brandSubcategory: product.subCategory || undefined,
      tags: product.tags || [],
      gender: product.gender || undefined,
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        gender: classification.gender,
        productType: classification.productType,
        department: classification.department,
        category: classification.category,
        subType: classification.subcategory,
        availabilityStatus: product.stock > 0 && product.isActive ? "IN_STOCK" : "OUT_OF_STOCK",
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("Product taxonomy backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
