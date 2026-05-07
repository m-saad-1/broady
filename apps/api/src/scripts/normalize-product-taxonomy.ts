import { prisma } from "../config/prisma.js";
import { normalizeProductTaxonomy } from "../modules/search/meilisearch.product-document.js";

async function main() {
  const products = await prisma.product.findMany({
    include: {
      brand: true,
      reviewAggregate: true,
    },
    orderBy: { id: "asc" },
  });

  let updatedCount = 0;
  let reviewCount = 0;

  for (const product of products) {
    const normalized = normalizeProductTaxonomy(product);
    const hasChanges = normalized.topCategory !== product.topCategory || normalized.subCategory !== product.subCategory;

    if (hasChanges) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          topCategory: normalized.topCategory,
          subCategory: normalized.subCategory,
        },
      });
      updatedCount += 1;
      console.log(`Updated ${product.slug}: ${product.topCategory} / ${product.subCategory} -> ${normalized.topCategory} / ${normalized.subCategory}`);
    }

    if (normalized.needsReview) {
      reviewCount += 1;
    }
  }

  console.log(`Done. Updated ${updatedCount}/${products.length} products. ${reviewCount} products still need manual review.`);
}

main()
  .catch((error: unknown) => {
    console.error("Failed to normalize product taxonomy:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });