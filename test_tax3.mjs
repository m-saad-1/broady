import fs from 'fs';
import { resolveBroadyTaxonomy } from './apps/api/src/modules/products/product-taxonomy.js';
const data = JSON.parse(fs.readFileSync('Data_Scrapping/breakout/breakout_fashion_marketplace_refined.json', 'utf8'));
let success = 0; let failed = 0;
for (const p of data) {
  const taxonomy = resolveBroadyTaxonomy({
    brandSlug: 'breakout',
    name: p.title,
    rawGender: p.gender,
    rawTopCategory: p.gender,
    rawCategory: p.category,
    rawSubCategory: p.subcategory || p.sub_type
  });
  const rawCat = taxonomy.category ? taxonomy.category.toUpperCase().replace(/\s+/g, "_") : "SHIRTS";
  const mappedSub = taxonomy.subType ? taxonomy.subType.toUpperCase().replace(/\s+/g, "_") : null;
  console.log('Title:', p.title.substring(0,20), 'Cat:', rawCat, 'Sub:', mappedSub);
}
