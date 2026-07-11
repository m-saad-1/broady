import { PrismaClient } from '@prisma/client';
import { buildWhereClause } from './src/modules/products/filter.service.js';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- Filtering Isolation Test Report ---');

  // Test 1: Department = CLOTHING never returns FOOTWEAR or ACCESSORIES
  let where = buildWhereClause({ department: ['CLOTHING'] });
  let items = await prisma.product.findMany({ where, select: { department: true } });
  let countInvalid = items.filter(i => i.department !== 'CLOTHING').length;
  console.log(`[Test 1] CLOTHING department isolation: ${countInvalid === 0 ? 'PASS' : 'FAIL'} (${countInvalid} leaked items)`);

  // Test 2: Category = SHIRTS never returns pants, jackets, or shoes
  where = buildWhereClause({ category: ['SHIRTS'] });
  items = await prisma.product.findMany({ where, select: { category: true } });
  countInvalid = items.filter(i => i.category !== 'SHIRTS').length;
  console.log(`[Test 2] SHIRTS category isolation: ${countInvalid === 0 ? 'PASS' : 'FAIL'} (${countInvalid} leaked items)`);

  await prisma.$disconnect();
}

runTests().catch(console.error);
