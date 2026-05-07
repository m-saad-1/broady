import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../config/prisma.js";
import { normalizeProductTaxonomy } from "../modules/search/meilisearch.product-document.js";

type ExportedProduct = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  searchDocument: string;
  pricePkr: number;
  topCategory: string;
  subCategory: string;
  sizes: string[];
  imageUrl: string;
  stock: number;
  isActive: boolean;
  approvalStatus: string;
  createdAt: number;
  updatedAt: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportPath = path.resolve(__dirname, "../../../../docs/MEILISEARCH_PRODUCTS_EXPORT.json");

function toDate(seconds: number) {
  return new Date(seconds * 1000);
}

async function main() {
  if (!fs.existsSync(exportPath)) {
    throw new Error(`Export file not found: ${exportPath}`);
  }

  const exportedProducts = JSON.parse(fs.readFileSync(exportPath, "utf8")) as ExportedProduct[];
  if (!Array.isArray(exportedProducts) || !exportedProducts.length) {
    throw new Error("Export file does not contain any products.");
  }

  let createdCount = 0;
  let updatedCount = 0;

  // Extract unique brands from exported products and ensure they exist
  const brandMap = new Map<string, { name: string; slug: string }>();
  for (const p of exportedProducts) {
    if (!brandMap.has(p.brandId)) {
      brandMap.set(p.brandId, { 
        name: (p as any).brandName || "Unknown Brand", 
        slug: (p as any).brandSlug || `unknown-${p.brandId}` 
      });
    }
  }

  console.log(`Ensuring ${brandMap.size} brands exist before importing products...`);
  for (const [id, brandData] of brandMap.entries()) {
    await prisma.brand.upsert({
      where: { id },
      update: {
        name: brandData.name,
        slug: brandData.slug,
      },
      create: {
        id,
        name: brandData.name,
        slug: brandData.slug,
      },
    });
  }

  for (const exported of exportedProducts) {
    const normalized = normalizeProductTaxonomy({
      id: exported.id,
      brandId: exported.brandId,
      name: exported.name,
      slug: exported.slug,
      description: exported.description,
      searchDocument: exported.searchDocument,
      pricePkr: exported.pricePkr,
      topCategory: exported.topCategory,
      subCategory: exported.subCategory,
      sizes: exported.sizes,
      imageUrl: exported.imageUrl,
      stock: exported.stock,
      isActive: exported.isActive,
      approvalStatus: exported.approvalStatus as never,
      createdAt: toDate(exported.createdAt),
      updatedAt: toDate(exported.updatedAt),
      reviewAggregate: null,
      brand: {} as never,
    } as never);

    const data = {
      brandId: exported.brandId,
      name: exported.name,
      slug: exported.slug,
      description: exported.description,
      searchDocument: exported.searchDocument,
      pricePkr: exported.pricePkr,
      actualPrice: exported.pricePkr,
      topCategory: normalized.topCategory,
      subCategory: normalized.subCategory,
      sizes: exported.sizes,
      imageUrl: exported.imageUrl,
      stock: exported.stock,
      isActive: exported.isActive,
      approvalStatus: exported.approvalStatus as "DRAFT" | "PENDING" | "APPROVED" | "REJECTED",
    };

    const existing = await prisma.product.findUnique({ where: { id: exported.id }, select: { id: true } });
    if (existing) {
      await prisma.product.update({ where: { id: exported.id }, data });
      updatedCount += 1;
    } else {
      await prisma.product.create({
        data: {
          id: exported.id,
          ...data,
          createdAt: toDate(exported.createdAt),
        },
      });
      createdCount += 1;
    }
  }

  console.log(`Imported ${exportedProducts.length} products from export: ${updatedCount} updated, ${createdCount} created.`);
}

main()
  .catch((error: unknown) => {
    console.error("Failed to import products from export:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });