const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/api/src/modules/products/product.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix imports
if (!content.includes('import { getAvailableFilters, buildWhereClause, type FilterState } from "./filter.service.js";')) {
    content = content.replace(
        'import { resolveBroadyTaxonomy } from "./product-taxonomy.js";',
        'import { resolveBroadyTaxonomy } from "./product-taxonomy.js";\nimport { getAvailableFilters, buildWhereClause, type FilterState } from "./filter.service.js";'
    );
}

// Fix duplicate buildSearchTokenCondition
const lines = content.split('\n');
const firstIndex = lines.findIndex(l => l.includes('function buildSearchTokenCondition(token: string): any {'));
const lastIndex = lines.findLastIndex(l => l.includes('function buildSearchTokenCondition(token: string): any {'));

if (firstIndex !== lastIndex && firstIndex !== -1 && lastIndex !== -1) {
    const linesToKeep = lines.slice(0, lastIndex).join('\n');
    content = linesToKeep;
}

// Fix as any for createProduct
content = content.replace(
    /isActive: options\?\.isActive \?\? productData\.isActive \?\? true,\n\s*\}/g,
    'isActive: options?.isActive ?? productData.isActive ?? true,\n    } as any,'
);

// Fix as any for updateProduct
content = content.replace(
    /\.\.\.pricing,\n\s*\}/g,
    '...pricing,\n        } as any,'
);

content = content.replace(
    /\.\.\.\(existingProduct as Partial<ProductCreateData>\),/g,
    '...existingProduct as any,'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed');
