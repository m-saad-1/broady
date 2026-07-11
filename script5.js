const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/app/catalog/catalog-client.tsx','utf8');
c = c.replace(
  '<option key={item.value} value={item.value}>\n                {item.value}\n              </option>',
  '<option key={item.value} value={item.value}>\n                {item.value === "Juniors" ? "Boys/Girls" : item.value}\n              </option>'
);
fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/app/catalog/catalog-client.tsx',c);
