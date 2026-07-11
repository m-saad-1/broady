const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/packages/shared/src/index.ts','utf8');

if (!c.includes('"underwear"')) {
  c = c.replace(
    '  "jewellery",\n] as const;',
    '  "jewellery",\n  "underwear",\n] as const;'
  );
  
  c = c.replace(
    '  "quilted",\n] as const;',
    '  "quilted",\n  "boxer",\n  "brief",\n] as const;'
  );
  
  c = c.replace(
    '  bottom: ["trouser", "pant", "jeans", "shorts", "skirt", "jogger", "cargo"],',
    '  bottom: ["trouser", "pant", "jeans", "shorts", "skirt", "jogger", "cargo", "underwear"],'
  );
  
  c = c.replace(
    '  jacket: ["denim", "leather", "bomber", "windbreaker", "quilted"],\n};',
    '  jacket: ["denim", "leather", "bomber", "windbreaker", "quilted"],\n  underwear: ["boxer", "brief", "basic", "printed", "striped"],\n};'
  );
  
  fs.writeFileSync('D:/WEB DEVELOPMENT/broady/packages/shared/src/index.ts', c);
}
