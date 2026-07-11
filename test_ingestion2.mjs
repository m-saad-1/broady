import fs from 'fs';
import { parseImportPayload } from './apps/api/src/modules/ingestion/parsers/ingestion.parser.js';
import { normalizeRecord } from './apps/api/src/modules/ingestion/services/normalization.service.js';
import { validateNormalizedProduct } from './apps/api/src/modules/ingestion/validators/ingestion.validator.js';
import { upsertNormalizedProduct } from './apps/api/src/modules/ingestion/repositories/ingestion.repository.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const payload = {
    brandId: 'brand_breakout',
    sourceType: 'REST_API',
    rawJson: JSON.parse(fs.readFileSync('./Data_Scrapping/breakout/breakout_fashion_marketplace_refined.json', 'utf8'))
  };

  const parsed = parseImportPayload(payload);
  console.log('Total items:', parsed.length);

  let success = 0;
  let failed = 0;
  let errorSet = new Set();

  for (const record of parsed) {
    try {
      const normalized = normalizeRecord(record, { brandSlug: 'breakout' });
      const issues = validateNormalizedProduct(normalized);
      
      const errors = issues.filter(i => i.level === 'ERROR');
      if (errors.length > 0) {
        failed++;
        errorSet.add(errors[0].message);
        continue;
      }
      success++;
    } catch (e) {
      failed++;
      errorSet.add(e.message);
    }
  }

  console.log('Success:', success, 'Failed:', failed);
  console.log('Unique errors:', Array.from(errorSet));
}

test().catch(console.error).finally(() => prisma.$disconnect());
