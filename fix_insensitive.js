const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/api/src/modules/products/product.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of `mode: "insensitive"` with `mode: "insensitive" as any` safely
// First clean up any that might already have `as any` to avoid `as any as any`
content = content.replace(/mode:\s*"insensitive"\s*as\s*any/g, 'mode: "insensitive"');
content = content.replace(/mode:\s*"insensitive"/g, 'mode: "insensitive" as any');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed insensitive casts');
