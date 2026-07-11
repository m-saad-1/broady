import { resolveBroadyTaxonomy } from './apps/api/src/modules/products/product-taxonomy.js';
const taxonomy = resolveBroadyTaxonomy({
  brandSlug: 'breakout',
  name: 'Relaxed Fit Mesh Button Down Baseball Jersey Shirt',
  rawGender: 'Men',
  rawTopCategory: 'Men',
  rawCategory: 'Clothing',
  rawSubCategory: 'Shirts'
});
console.log('Subtype:', taxonomy.subType);
