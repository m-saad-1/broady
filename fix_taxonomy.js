const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/api/src/modules/products/taxonomy.ts','utf8');

if(!c.includes("UNDERWEAR = 'UNDERWEAR'")) {
  c = c.replace(
    "  TIES = 'TIES',",
    "  TIES = 'TIES',\n  UNDERWEAR = 'UNDERWEAR',"
  );
  
  c = c.replace(
    "  [Category.TIES]: ProductType.ACCESSORY,",
    "  [Category.TIES]: ProductType.ACCESSORY,\n  [Category.UNDERWEAR]: ProductType.BOTTOM,"
  );
  
  c = c.replace(
    "  [Category.TIES]: Department.ACCESSORIES,",
    "  [Category.TIES]: Department.ACCESSORIES,\n  [Category.UNDERWEAR]: Department.CLOTHING,"
  );
  
  c = c.replace(
    "  [Category.TIES]: ['tie', 'necktie', 'bow tie'],",
    "  [Category.TIES]: ['tie', 'necktie', 'bow tie'],\n  [Category.UNDERWEAR]: ['underwear', 'boxer', 'brief', 'panties', 'trunk', 'thong', 'bra', 'lingerie', 'boxers', 'undergarment'],"
  );
  
  c = c.replace(
    "  NO_SHOW_SOCKS = 'NO_SHOW_SOCKS',",
    "  NO_SHOW_SOCKS = 'NO_SHOW_SOCKS',\n  BOXERS = 'BOXERS',\n  BRIEFS = 'BRIEFS',"
  );
  
  c = c.replace(
    "  [Subcategory.NO_SHOW_SOCKS]: Category.SOCKS,",
    "  [Subcategory.NO_SHOW_SOCKS]: Category.SOCKS,\n  [Subcategory.BOXERS]: Category.UNDERWEAR,\n  [Subcategory.BRIEFS]: Category.UNDERWEAR,"
  );
  
  fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/api/src/modules/products/taxonomy.ts', c);
}
