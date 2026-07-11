import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { normalizeRecord } from './apps/api/src/modules/ingestion/services/normalization.service.js';
import { parseImportPayload } from './apps/api/src/modules/ingestion/parsers/ingestion.parser.js';

const prisma = new PrismaClient();

async function run() {
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
  console.log('Normalized Ext ID:', normalized.externalProductId, 'Slug:', normalized.slug);
  console.log('Existing matched:', existing?.id);
}
run().finally(() => prisma.$disconnect());
