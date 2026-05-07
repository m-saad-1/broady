import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../config/prisma.js";
import { mapProductToMeiliDocument } from "../modules/search/meilisearch.product-document.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, "../../../..", "docs", "MEILISEARCH_PRODUCTS_EXPORT.json");

async function main() {
  const products = await prisma.product.findMany({
    include: {
      brand: true,
      reviewAggregate: true,
    },
    orderBy: { id: "asc" },
  });

  const documents = products.map(mapProductToMeiliDocument);
  fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2), "utf8");

  console.log(`Exported ${documents.length} products to ${outputPath}`);
}

main()
  .catch((error: unknown) => {
    console.error("Failed to export products:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });