const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/api/src/modules/products/product.service.ts');
let fileContent = fs.readFileSync(filePath, 'utf8');

// 1. Add imports if they don't exist
if (!fileContent.includes('getAvailableFilters')) {
    fileContent = fileContent.replace('import { resolveBroadyTaxonomy } from "./product-taxonomy.js";', 'import { resolveBroadyTaxonomy } from "./product-taxonomy.js";\nimport { getAvailableFilters, buildWhereClause, type FilterState } from "./filter.service.js";');
}

// 2. Remove duplicate buildSearchTokenCondition
const lines = fileContent.split('\n');
const lastIndex = lines.findLastIndex(line => line.includes('function buildSearchTokenCondition(token: string): any {'));
const firstIndex = lines.findIndex(line => line.includes('function buildSearchTokenCondition(token: string): any {'));

if (lastIndex !== firstIndex && lastIndex !== -1) {
    // Delete the appended one
    fileContent = lines.slice(0, lastIndex).join('\n');
}

// 3. Fix the `as any` issue
if (!fileContent.includes('} as any,')) {
    fileContent = fileContent.replace('      isActive: options?.isActive ?? productData.isActive ?? true,\n    },', '      isActive: options?.isActive ?? productData.isActive ?? true,\n    } as any,');
    
    // Also the update product: `...pricing,`
    fileContent = fileContent.replace('...pricing,\n    },', '...pricing,\n    } as any,');
}

fs.writeFileSync(filePath, fileContent, 'utf8');
console.log("Patched successfully.");
