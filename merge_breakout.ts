import fs from 'fs';
import path from 'path';
import { resolveBroadyTaxonomy } from './apps/api/src/modules/products/product-taxonomy.js';

const broadyPath = './Data_Scrapping/breakout/breakout_broady.json';
const expandedPath = './Data_Scrapping/breakout/breakout_expanded.json';
const outputPath = './Data_Scrapping/breakout/breakout_fashion_marketplace_refined.json';

function getEmptyBroadyProduct() {
  return {
    "id": "",
    "external_product_id": "",
    "external_source": "Breakout",
    "brand_id": "breakout",
    "brand_name": "Breakout",
    "title": "",
    "slug": "",
    "short_description": "",
    "description": "",
    "gender": "",
    "division": "",
    "category": "",
    "subcategory": "",
    "product_type": "",
    "fit": "",
    "season": "",
    "collection": "",
    "product_url": "",
    "actual_price": 0,
    "currency": "PKR",
    "label": "",
    "colors": [],
    "sizes": [],
    "variants": [],
    "images": [],
    "stock": 10,
    "shipping_delivery": null,
    "deliveries_returns": null,
    "fabric_care": null,
    "detail": null,
    "seo": null,
    "additional_info": [],
    "tags": [],
    "status": "active",
    "approval_status": "APPROVED",
    "visibility": "visible",
    "source": "Scraper",
    "source_format": "JSON",
    "mapping_status": "unresolved",
    "sub_type": null,
    "sub_type_confidence": "null",
    "resolution_source": "unresolved",
    "page_context": null,
    "raw": null
  };
}

async function run() {
  const broadyData = JSON.parse(fs.readFileSync(broadyPath, 'utf8'));
  const expandedData = JSON.parse(fs.readFileSync(expandedPath, 'utf8'));

  const urlMap = new Map();

  for (const item of broadyData) {
    if (item.product_url) {
      urlMap.set(item.product_url, item);
    }
  }

  for (const segment of expandedData) {
    const products = segment.products || [];
    for (const p of products) {
      if (!p.product_url) continue;

      let item = urlMap.get(p.product_url);
      if (!item) {
        item = getEmptyBroadyProduct();
        item.external_product_id = p.external_product_id || '';
        item.title = p.title || '';
        item.product_url = p.product_url;
        item.actual_price = p.actual_price || 0;
        item.sale_price = p.sale_price || null;
        item.gender = p.gender || '';
        item.category = p.category || '';
        item.subcategory = p.subcategory || '';
        item.product_type = p.product_type || '';
        item.colors = p.colors || [];
        item.sizes = p.sizes || [];
        item.images = p.images || [];
        item.variants = p.variants || [];
        item.page_context = p.page_context || null;
        
        // Add to map
        urlMap.set(p.product_url, item);
      }
    }
  }

  const merged = Array.from(urlMap.values());
  let normalizedCount = 0;

  for (const item of merged) {
    const title = item.title;
    const url = item.product_url;
    const breadcrumb = item.page_context?.breadcrumb_raw || [];
    const sizes = item.sizes || [];
    
    const taxonomy = resolveBroadyTaxonomy({
      brandSlug: 'breakout',
      name: title,
      rawGender: item.gender || null,
      rawTopCategory: null,
      rawCategory: item.category || null,
      rawSubCategory: item.subcategory || null,
      productUrl: url,
      breadcrumb,
      sizes
    });
    
    const expectedSubcategory = taxonomy.legacySubCategory;
    const expectedCat = taxonomy.legacyProductType === 'Top' ? 'Clothing' : taxonomy.legacyProductType === 'Bottom' ? 'Clothing' : taxonomy.legacyProductType === 'Footwear' ? 'Shoes' : 'Accessories';
    
    let changed = false;
    if (item.category !== expectedCat) {
      item.category = expectedCat;
      changed = true;
    }
    if (item.subcategory !== expectedSubcategory) {
      item.subcategory = expectedSubcategory;
      changed = true;
    }
    
    if (taxonomy.gender) {
      const g = taxonomy.gender === 'unisex' ? 'Unisex' : taxonomy.gender === 'men' ? 'Men' : taxonomy.gender === 'women' ? 'Women' : taxonomy.gender === 'boys' ? 'Junior Boys' : taxonomy.gender === 'girls' ? 'Junior Girls' : 'Unisex';
      if (item.gender !== g) {
        item.gender = g;
        changed = true;
      }
    }

    item.sub_type = taxonomy.subType;
    item.sub_type_confidence = taxonomy.subTypeConfidence;
    item.resolution_source = taxonomy.resolutionSource;
    item.mapping_status = taxonomy.mappingStatus;

    if (changed) normalizedCount++;
  }

  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`Merged and normalized ${merged.length} products. Updated taxonomies for ${normalizedCount} items.`);
  console.log(`Saved to ${outputPath}`);
}

run().catch(console.error);
