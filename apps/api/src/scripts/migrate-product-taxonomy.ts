/**
 * Data Migration Script: Existing Products → New Taxonomy
 *
 * This script migrates existing products to the new taxonomy system.
 * Run after Prisma schema migration is applied.
 *
 * Usage:
 *   ts-node src/scripts/migrate-product-taxonomy.ts [--dry-run] [--batch-size=100]
 */

import { PrismaClient, ProductAvailability } from '@prisma/client';
import {
  classifyProduct,
  validateClassification,
  generateSearchKeywords,
} from '../modules/products/classification.service.js';
import { normalizeGender } from '../modules/products/taxonomy.js';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  lowConfidence: number;
  errors: Array<{ productId: string; error: string }>;
}

async function migrateProductTaxonomy(options: {
  dryRun: boolean;
  batchSize: number;
}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    failed: 0,
    lowConfidence: 0,
    errors: [],
  };

  try {
    console.log('🚀 Starting product taxonomy migration...');
    console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Batch size: ${options.batchSize}\n`);

    const totalProducts = await prisma.product.count({
      where: { deletedAt: null },
    });
    stats.total = totalProducts;

    console.log(`📊 Total products to migrate: ${totalProducts}\n`);

    let processed = 0;
    let skip = 0;

    while (processed < totalProducts) {
      const batch = await prisma.product.findMany({
        where: { deletedAt: null },
        include: { brand: true },
        skip,
        take: options.batchSize,
      });

      console.log(
        `Processing batch ${Math.floor(processed / options.batchSize) + 1}...`
      );

      for (const product of batch) {
        try {
          const classification = await classifyProduct({
            title: product.name,
            description: product.description,
            brandCategory: (product as any).topCategory,
            brandSubcategory: (product as any).subCategory,
            gender: (product as any).gender,
            tags: product.tags,
          });

          const validation = validateClassification(classification);
          if (!validation.valid) {
            throw new Error(
              `Validation failed: ${validation.errors.join(', ')}`
            );
          }

          const searchKeywords = generateSearchKeywords(
            classification,
            product.name
          );

          const normalizedGender =
            normalizeGender((product as any).gender) || classification.gender;

          const colors = (product as any).color
            ? [(product as any).color]
            : [];

          const updateData = {
            gender: normalizedGender,
            productType: classification.productType,
            department: classification.department,
            category: classification.category,
            subcategory: classification.subcategory,
            brandCategoryRaw: (product as any).topCategory || null,
            brandSubcategoryRaw: (product as any).subCategory || null,
            colors,
            searchKeywords,
            availabilityStatus: product.stock > 0 ? ProductAvailability.IN_STOCK : ProductAvailability.OUT_OF_STOCK,
            classificationConfidence: classification.confidence,
          };

          if (!options.dryRun) {
            await prisma.product.update({
              where: { id: product.id },
              data: updateData,
            });
          }

          stats.successful++;

          if (classification.confidence < 0.7) {
            stats.lowConfidence++;
            console.log(
              `⚠️  [${product.id}] Low confidence (${classification.confidence.toFixed(2)}): ${product.name}`
            );
          } else {
            console.log(
              `✅ [${product.id}] ${product.name} → ${classification.category} (${classification.confidence.toFixed(2)})`
            );
          }
        } catch (error) {
          stats.failed++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push({
            productId: product.id,
            error: errorMessage,
          });
          console.error(
            `❌ [${product.id}] Failed: ${product.name} - ${errorMessage}`
          );
        }
      }

      processed += batch.length;
      skip += options.batchSize;

      console.log(
        `Progress: ${processed}/${totalProducts} (${Math.round((processed / totalProducts) * 100)}%)\n`
      );
    }

    console.log('\n✨ Migration complete!\n');
    console.log('📈 Statistics:');
    console.log(`   Total products: ${stats.total}`);
    console.log(`   Successful: ${stats.successful}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Low confidence: ${stats.lowConfidence}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(({ productId, error }) => {
        console.log(`   [${productId}] ${error}`);
      });
    }

    if (stats.lowConfidence > 0) {
      console.log(
        `\n⚠️  ${stats.lowConfidence} products need manual review (confidence < 0.7)`
      );
      console.log(
        '   These products are now visible in the admin classification review panel.'
      );
    }

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN: No changes were made to the database.');
    }

    return stats;
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg
  ? parseInt(batchSizeArg.split('=')[1], 10)
  : 100;

// Run migration
migrateProductTaxonomy({ dryRun, batchSize })
  .then(stats => {
    process.exit(stats.failed > 0 ? 1 : 0);
  })
  .catch(() => {
    process.exit(1);
  });
