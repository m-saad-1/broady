import fs from 'fs';
import path from 'path';
import { resolveBroadyTaxonomy } from '../src/modules/products/product-taxonomy.js';

const FILES_TO_FIX = [
  '../../Data_Scrapping/outfitters/outfitters_fashion_marketplace_refined.json',
  '../../Data_Scrapping/cougar/broady_fashion_marketplace.json'
];

async function run() {
  for (const relPath of FILES_TO_FIX) {
    const filePath = path.resolve(relPath);
    console.log(`Processing: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let changes = 0;

    for (const item of data) {
      // Re-resolve taxonomy based on title, URL, breadcrumbs, etc.
      // item.raw.originalProductJson could be ignored since we can just use item.product_url and item.title
      const title = item.title;
      const url = item.product_url || (item.raw && item.raw.sourceUrl);
      const sizes = item.sizes || [];
      const brandSlug = item.brand_name ? item.brand_name.toLowerCase() : undefined;
      
      const breadcrumb = item.raw?.originalProductJson?.breadcrumb || [];
      
      // We pass rawGender as null to force it to re-evaluate from URL/title/sizes
      const taxonomy = resolveBroadyTaxonomy({
        brandSlug,
        name: title,
        rawGender: null,
        rawTopCategory: null,
        rawCategory: null,
        rawSubCategory: null,
        productUrl: url,
        breadcrumb,
        sizes
      });
      
      const newGender = taxonomy.gender === 'unisex' ? 'Unisex' : taxonomy.gender === 'men' ? 'Men' : taxonomy.gender === 'women' ? 'Women' : taxonomy.gender === 'boys' ? 'Junior Boys' : taxonomy.gender === 'girls' ? 'Junior Girls' : 'Unisex';
      const newCategory = taxonomy.legacyProductType === 'Top' ? 'Clothing' : taxonomy.legacyProductType === 'Bottom' ? 'Clothing' : taxonomy.legacyProductType === 'Footwear' ? 'Shoes' : 'Accessories';
      
      // Update gender if it was incorrectly set to Women
      if (item.gender === 'Women' && taxonomy.gender !== 'women') {
        item.gender = newGender;
        changes++;
      } else if (!item.gender) {
         item.gender = newGender;
         changes++;
      }

      // We should also map the category properly based on taxonomy.category
      if (taxonomy.category) {
        const expectedSubcategory = taxonomy.legacySubCategory;
        if (item.subcategory !== expectedSubcategory) {
          item.subcategory = expectedSubcategory;
          item.category = newCategory;
          changes++;
        }
      }
    }

    if (changes > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Fixed ${changes} items in ${path.basename(filePath)}`);
    } else {
      console.log(`No changes needed in ${path.basename(filePath)}`);
    }
  }
}

run().catch(console.error);
