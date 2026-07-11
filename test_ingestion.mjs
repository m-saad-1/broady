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
  console.log('Parsed:', parsed.length);

  for (const record of parsed.slice(0, 1)) {
    try {
      const normalized = normalizeRecord(record, { brandSlug: 'breakout' });
      const issues = validateNormalizedProduct(normalized);
      console.log('Issues:', issues);

      if (issues.filter(i => i.level === 'ERROR').length === 0) {
        console.log('Upserting...');
        await upsertNormalizedProduct('brand_breakout', 'test_job_123', normalized);
        console.log('Success!');
      }
    } catch (e) {
      console.error('ERROR OCCURRED:', e);
    }
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
