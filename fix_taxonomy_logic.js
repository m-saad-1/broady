const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/api/src/modules/products/product-taxonomy.ts','utf8');

if (!c.includes('underwear: "underwear"')) {
  c = c.replace(
    '  accessories: "bag",\n};',
    '  accessories: "bag",\n  underwear: "underwear",\n  boxer: "underwear",\n  boxers: "underwear",\n  brief: "underwear",\n  briefs: "underwear",\n};'
  );
  
  c = c.replace(
    '  quilted: "quilted",\n};',
    '  quilted: "quilted",\n  boxer: "boxer",\n  boxers: "boxer",\n  brief: "brief",\n  briefs: "brief",\n};'
  );

  c = c.replace(
    '  jewellery: "Jewellery",\n};',
    '  jewellery: "Jewellery",\n  underwear: "Underwear",\n};'
  );

  fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/api/src/modules/products/product-taxonomy.ts', c);
}
