import fs from 'fs';
import { parseImportPayload } from './apps/api/src/modules/ingestion/parsers/ingestion.parser.js';
import { normalizeRecord } from './apps/api/src/modules/ingestion/services/normalization.service.js';

const data = JSON.parse(fs.readFileSync('Data_Scrapping/breakout/breakout_fashion_marketplace_refined.json', 'utf8'));
const parsed = parseImportPayload({ sourceType: 'REST_API', rawJson: data });

let failedProducts = 0;
for (const p of parsed) {
  const norm = normalizeRecord(p, { brandSlug: 'breakout' });
  const skus = norm.variants.map(v => v.sku);
  const unique = new Set(skus);
  if (skus.length !== unique.size) {
    console.log('DUPE IN PRODUCT:', norm.name);
    console.log(skus);
    failedProducts++;
  }
}
console.log('Products with duplicate SKUs internally:', failedProducts);
