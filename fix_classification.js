const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/api/src/modules/products/classification.service.ts','utf8');

if (!c.includes('productType?: string;')) {
  c = c.replace(
    '  gender?: string;',
    '  gender?: string;\n  productType?: string;'
  );
  
  c = c.replace(
    '      if (data.brandSubcategory && regex.test(data.brandSubcategory)) {\n        score += 6;\n      }',
    '      if (data.brandSubcategory && regex.test(data.brandSubcategory)) {\n        score += 6;\n      }\n\n      if (data.productType && regex.test(data.productType)) {\n        score += 15;\n      }'
  );
  
  c = c.replace(
    '    data.brandSubcategory || \\'\\',',
    '    data.brandSubcategory || \\'\\',\n    data.productType || \\'\\','
  );

  fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/api/src/modules/products/classification.service.ts', c);
}
