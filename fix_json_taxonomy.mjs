import fs from 'fs';
import { resolveBroadyTaxonomy } from './apps/api/src/modules/products/product-taxonomy.js';

const files = [
  './Data_Scrapping/breakout/breakout_broady.json',
  './Data_Scrapping/outfitters/outfitters_fashion_marketplace_refined.json',
  './Data_Scrapping/cougar/broady_fashion_marketplace.json'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changes = 0;
  for (const item of data) {
    const title = item.title || item.name;
    const url = item.product_url || (item.raw && item.raw.sourceUrl);
    const breadcrumb = item.raw?.originalProductJson?.breadcrumb || [];
    const brandSlug = item.brand_name ? item.brand_name.toLowerCase() : undefined;
    
    const taxonomy = resolveBroadyTaxonomy({
      brandSlug, name: title, rawGender: null, rawTopCategory: null, rawCategory: null, rawSubCategory: null, productUrl: url, breadcrumb, sizes: item.sizes || []
    });
    
    if (taxonomy.category) {
      const expectedSubcategory = taxonomy.legacySubCategory;
      const expectedCat = taxonomy.legacyProductType === 'Top' ? 'Clothing' : taxonomy.legacyProductType === 'Bottom' ? 'Clothing' : taxonomy.legacyProductType === 'Footwear' ? 'Shoes' : 'Accessories';
      
      if (item.subcategory !== expectedSubcategory || item.category !== expectedCat) {
        item.subcategory = expectedSubcategory;
        item.category = expectedCat;
        changes++;
      }
    }
  }
  if (changes > 0) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(Fixed  items in );
  }
}
