import fs from 'fs';
import path from 'path';
import { classifyProduct } from './apps/api/src/modules/products/classification.service.js';

const outfittersPath = './Data_Scrapping/outfitters/outfitters_fashion_marketplace_refined.json';
const breakoutPath = './Data_Scrapping/breakout/breakout_broady.json';

async function test(file: string) {
  if (!fs.existsSync(file)) {
    console.log('Not found:', file);
    return;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\nTesting ${file} (${data.length} items)...`);
  
  let issues = 0;
  for (const item of data) {
    const title = item.title || item.name;
    const desc = item.description || item.desc;
    const cat = item.category || item.topCategory;
    const subcat = item.subcategory || item.subCategory;
    
    // We mock the normalization extract step
    const breadcrumbs = item.breadcrumbs || [];
    const productType = item.product_type || item.productType || (item.raw && item.raw.originalProductJson && item.raw.originalProductJson.product_type);
    
    const classification = await classifyProduct({
      title,
      description: desc,
      brandCategory: cat,
      brandSubcategory: subcat,
      gender: item.gender,
      productType: productType
    });
    
    // If it falls back to T_SHIRTS but it's not a t-shirt, or if confidence is low
    const isFallback = classification.category === 'T_SHIRTS' && !title.toLowerCase().includes('t-shirt') && !title.toLowerCase().includes('tee');
    const isMisc = ['CLOTHING', 'ACCESSORIES'].includes(classification.category);
    
    if (classification.confidence < 0.7 || isFallback || isMisc || !classification.category) {
      if (issues < 20) {
        console.log(`- [${classification.confidence.toFixed(2)}] Title: "${title}" | RawCat: "${cat}/${subcat}" | ProdType: "${productType}" -> Class: ${classification.category} / ${classification.subcategory}`);
      }
      issues++;
    }
  }
  console.log(`Total potential issues in ${path.basename(file)}: ${issues}`);
}

async function run() {
  await test(outfittersPath);
  await test(breakoutPath);
}

run().catch(console.error);
