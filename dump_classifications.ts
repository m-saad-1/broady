import fs from 'fs';
import { classifyProduct } from './apps/api/src/modules/products/classification.service.js';

const outfittersPath = './Data_Scrapping/outfitters/outfitters_fashion_marketplace_refined.json';
const breakoutPath = './Data_Scrapping/breakout/breakout_broady.json';

async function dump(file: string) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n\n--- DUMP FOR ${file} ---`);
  for (const item of data) {
    const title = item.title || item.name;
    const cat = item.category || item.topCategory;
    const subcat = item.subcategory || item.subCategory;
    const productType = item.product_type || item.productType || (item.raw && item.raw.originalProductJson && item.raw.originalProductJson.product_type);
    
    const classification = await classifyProduct({
      title,
      description: item.description,
      brandCategory: cat,
      brandSubcategory: subcat,
      gender: item.gender,
      productType
    });
    console.log(`[${classification.confidence.toFixed(2)}] "${title}" -> Gender: ${classification.gender} | Category: ${classification.category} | Subcat: ${classification.subcategory || 'null'}`);
  }
}

async function run() {
  await dump(outfittersPath);
  await dump(breakoutPath);
}

run().catch(console.error);
