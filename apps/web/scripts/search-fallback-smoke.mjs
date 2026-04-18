import { fallbackProducts } from "../src/lib/mock-data.ts";
import { filterProductsBySubCategoryContains } from "../src/lib/search-fallback.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const products = fallbackProducts.map((p) => ({
  ...p,
  productType: p.productType || "Top",
}));

const shortQuery = filterProductsBySubCategoryContains(products, "ja");
assert(shortQuery.length === 0, "Expected no results for query length < 3");

const longQuery = filterProductsBySubCategoryContains(products, "jack");
assert(longQuery.every((p) => p.subCategory.toLowerCase().includes("jack")), "Expected all results to match subCategory contains");

const catalogLikeApiResult = [];
const catalogFallback = catalogLikeApiResult.length
  ? catalogLikeApiResult
  : filterProductsBySubCategoryContains(products, "wear");
assert(catalogFallback.length > 0, "Expected catalog fallback to return matches for subCategory contains");

const liveApiProducts = [];
const liveFallback = liveApiProducts.length
  ? liveApiProducts
  : filterProductsBySubCategoryContains(products, "shoe");
assert(liveFallback.length > 0, "Expected live-search fallback to return matches for subCategory contains");

console.log("search-fallback smoke: PASS");
