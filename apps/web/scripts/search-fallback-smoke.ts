import { fallbackProducts } from "../src/lib/mock-data";
import { filterProductsBySearchQuery } from "../src/lib/search-fallback";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const products = fallbackProducts.map((p) => ({
  ...p,
  productType: p.productType || "Top",
}));

const shortQuery = filterProductsBySearchQuery(products, "ja");
assert(shortQuery.length === 0, "Expected no results for query length < 3");

const longQuery = filterProductsBySearchQuery(products, "women jackets");
assert(
  longQuery.every((p) => [p.name, p.subCategory, p.topCategory].join(" ").toLowerCase().includes("women")),
  "Expected gender tokens to match",
);
assert(
  longQuery.every((p) => [p.name, p.subCategory].join(" ").toLowerCase().includes("jacket")),
  "Expected category tokens to match",
);

const catalogLikeApiResult: typeof products = [];
const catalogFallback = catalogLikeApiResult.length
  ? catalogLikeApiResult
  : filterProductsBySearchQuery(products, "men polo");
assert(
  catalogFallback.every((p) => [p.name, p.subCategory, p.topCategory].join(" ").toLowerCase().includes("men")),
  "Expected catalog fallback to be strict",
);

const liveApiProducts: typeof products = [];
const liveFallback = liveApiProducts.length
  ? liveApiProducts
  : filterProductsBySearchQuery(products, "sneakers");
assert(
  liveFallback.every((p) => [p.name, p.subCategory].join(" ").toLowerCase().includes("sneaker")),
  "Expected live-search fallback to stay strict",
);

console.log("search-fallback smoke: PASS");
