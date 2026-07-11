import { PrismaClient } from '@prisma/client';
import { mapOptionsToFilterState } from './src/modules/products/product.service.js';
import { buildWhereClause } from './src/modules/products/filter.service.js';

const prisma = new PrismaClient();

async function main() {
  const options = {
    category: "SHIRTS"
  };

  console.log("Input options:", options);
  
  const filterState = mapOptionsToFilterState(options);
  console.log("Filter State:", JSON.stringify(filterState, null, 2));

  const where = buildWhereClause(filterState);
  console.log("Prisma Where Clause:", JSON.stringify(where, null, 2));

  const count = await prisma.product.count({ where });
  console.log(`Matching Products: ${count}`);

  const sample = await prisma.product.findFirst({ where });
  console.log("Sample:", sample ? sample.id : "None");
}

main().catch(console.error).finally(() => prisma.$disconnect());
