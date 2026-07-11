const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/api/src/modules/products/product.service.ts');
const fileContent = fs.readFileSync(filePath, 'utf8');

// The file has a garbage line due to UTF-16LE append
const cleanLines = fileContent.split(/\r?\n/).filter(line => !line.includes('\0') && !line.includes('f u n c t i o n'));

const newFunction = `
function buildSearchTokenCondition(token: string): any {
  return {
    OR: [
      { name: { contains: token, mode: "insensitive" } },
      { description: { contains: token, mode: "insensitive" } },
      { brand: { name: { contains: token, mode: "insensitive" } } }
    ]
  };
}
`;

fs.writeFileSync(filePath, cleanLines.join('\n') + '\n' + newFunction, 'utf8');
console.log("Fixed UTF-16LE corruption and appended function.");
