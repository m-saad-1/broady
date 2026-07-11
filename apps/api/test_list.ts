import { listProducts } from './src/modules/products/product.service.js';

async function main() {
  const products = await listProducts({ category: "SHIRTS" });
  console.log("ListProducts output:", products.length);
}

main().catch(console.error);
