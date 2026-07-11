import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { parseImportPayload } from './apps/api/src/modules/ingestion/parsers/ingestion.parser.js';
import { normalizeRecord } from './apps/api/src/modules/ingestion/services/normalization.service.js';

const prisma = new PrismaClient();

async function test() {
  const payload = {
    brandId: 'cmrgcn9g80005h2qgsljije3j',
    sourceType: 'REST_API',
    rawJson: JSON.parse(fs.readFileSync('./Data_Scrapping/breakout/breakout_fashion_marketplace_refined.json', 'utf8'))
  };

  const parsed = parseImportPayload(payload);
  const normalized = normalizeRecord(parsed[0], { brandSlug: 'breakout' });
  
  const existing = await prisma.product.findFirst({
    where: {
      brandId: payload.brandId,
      OR: [
        normalized.externalProductId ? { externalProductId: normalized.externalProductId } : undefined,
        { slug: normalized.slug },
      ].filter(Boolean)
    }
  });

  console.log('Existing matched:', existing?.id);
  
  if (existing) {
    const deleted = await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
    console.log('Deleted variants:', deleted.count);
    
    // verify
    const left = await prisma.productVariant.count({ where: { productId: existing.id } });
    console.log('Left variants:', left);
    
    for (const variant of normalized.variants) {
      console.log('Creating SKU:', variant.sku);
      try {
        await prisma.productVariant.create({
          data: {
            productId: existing.id,
            externalVariantId: variant.externalVariantId,
            sku: variant.sku,
            pricePkr: 0
          }
        });
        console.log('Created!', variant.sku);
      } catch (e) {
        console.log('FAILED!', variant.sku, e.message);
      }
    }
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
