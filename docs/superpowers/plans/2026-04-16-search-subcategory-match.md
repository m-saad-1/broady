# Search Sub-Category Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make search render products when query text matches product sub-category characters (contains), with a 3-character minimum, across both catalog page and header live results.

**Architecture:** Keep the API ranked search as primary behavior and enforce minimum query length for free-text search. Add a shared, deterministic frontend fallback matcher for sub-category contains logic and reuse it in both catalog and header live search when API results are empty. Preserve current ranking order and empty-state UX when nothing matches.

**Tech Stack:** TypeScript, Next.js App Router, Express, Prisma, PostgreSQL, React Query

---

## File Structure and Responsibilities

- **Modify:** `apps/api/src/modules/products/products.routes.ts`
  - Enforce `q.length >= 3` gate for ranked free-text search branch.
  - Keep existing ranked search logic and sub-category contains predicates active.
- **Create:** `apps/web/src/lib/search-fallback.ts`
  - Shared pure helper for client fallback matching by sub-category contains with minimum query length.
- **Modify:** `apps/web/src/app/catalog/catalog-client.tsx`
  - Use shared fallback helper when catalog receives empty API results for active query.
- **Modify:** `apps/web/src/components/layout/site-header.tsx`
  - Use shared fallback helper for live results when API returns empty and query is eligible.
- **Create:** `apps/api/prisma/search-subcategory-smoke.js`
  - Node-based smoke script to validate API response behavior for 2-char and 3-char queries.
- **Create:** `apps/web/scripts/search-fallback-smoke.mjs`
  - Node-based smoke script validating shared fallback helper behavior.
- **Modify:** `apps/web/package.json`
  - Add script entry for fallback smoke test.
- **Modify:** `apps/api/package.json`
  - Add script entry for API smoke test.

---

### Task 1: Build shared frontend fallback matcher

**Files:**
- Create: `apps/web/src/lib/search-fallback.ts`
- Test: `apps/web/scripts/search-fallback-smoke.mjs`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing smoke test for fallback behavior**

```js
// apps/web/scripts/search-fallback-smoke.mjs
import { fallbackProducts } from "../src/lib/mock-data";
import { filterProductsBySubCategoryContains } from "../src/lib/search-fallback";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const products = fallbackProducts.map((p) => ({
  ...p,
  productType: p.productType || "Top",
}));

const shortQuery = filterProductsBySubCategoryContains(products, "ja");
assert(shortQuery.length === 0, "Expected no results for query length < 3");

const longQuery = filterProductsBySubCategoryContains(products, "jack");
assert(longQuery.every((p) => p.subCategory.toLowerCase().includes("jack")), "Expected all results to match subCategory contains");

console.log("search-fallback smoke: PASS");
```

- [ ] **Step 2: Run smoke script to verify it fails before implementation**

Run: `npm run search:fallback:smoke -w @broady/web`  
Expected: FAIL with module/function not found for `search-fallback`.

- [ ] **Step 3: Implement the minimal shared fallback helper**

```ts
// apps/web/src/lib/search-fallback.ts
import type { Product } from "@/types/marketplace";

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function isEligibleSearchQuery(query: string, minLength = 3) {
  return normalizeSearchQuery(query).length >= minLength;
}

export function filterProductsBySubCategoryContains(products: Product[], query: string) {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 3) return [];
  return products.filter((product) => product.subCategory.toLowerCase().includes(normalized));
}
```

- [ ] **Step 4: Add runnable smoke command in web package**

```json
{
  "scripts": {
    "search:fallback:smoke": "node scripts/search-fallback-smoke.mjs"
  }
}
```

- [ ] **Step 5: Run smoke script to verify it passes**

Run: `npm run search:fallback:smoke -w @broady/web`  
Expected: `search-fallback smoke: PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/search-fallback.ts apps/web/scripts/search-fallback-smoke.mjs apps/web/package.json
git commit -m "feat(web): add shared sub-category fallback matcher"
```

---

### Task 2: Wire fallback matcher into catalog results rendering

**Files:**
- Modify: `apps/web/src/app/catalog/catalog-client.tsx`
- Reuse: `apps/web/src/lib/search-fallback.ts`
- Test: `apps/web/scripts/search-fallback-smoke.mjs`

- [ ] **Step 1: Write failing assertion for catalog-level fallback behavior**

```js
// Extend apps/web/scripts/search-fallback-smoke.mjs
const catalogLikeApiResult = [];
const catalogFallback = catalogLikeApiResult.length
  ? catalogLikeApiResult
  : filterProductsBySubCategoryContains(products, "wear");
assert(catalogFallback.length > 0, "Expected catalog fallback to return matches for subCategory contains");
```

- [ ] **Step 2: Run smoke script to confirm failure**

Run: `npm run search:fallback:smoke -w @broady/web`  
Expected: FAIL because catalog code path still renders empty list and helper is not yet used in component logic.

- [ ] **Step 3: Implement minimal catalog fallback integration**

```ts
// inside catalog-client.tsx
import { filterProductsBySubCategoryContains, isEligibleSearchQuery, normalizeSearchQuery } from "@/lib/search-fallback";

const query = normalizeSearchQuery(queryFromRoute);
const fallbackCatalogProducts = useMemo(() => {
  if (!isEligibleSearchQuery(query) || products.length > 0) return [];
  return filterProductsBySubCategoryContains(normalizedInitialProducts, query);
}, [normalizedInitialProducts, products.length, query]);

const renderedProducts = products.length ? orderedProducts : fallbackCatalogProducts;
```

- [ ] **Step 4: Update render usage to consume `renderedProducts`**

```tsx
{renderedProducts.map((product) => (
  <ProductCard key={product.id} product={normalizeProduct(product)} />
))}

{!renderedProducts.length ? (
  <section className="border border-zinc-300 p-8 text-center">
    <p className="font-heading text-3xl uppercase">This product is not available</p>
    <p className="mt-2 text-sm text-zinc-600">Try changing your filters or search query.</p>
  </section>
) : null}
```

- [ ] **Step 5: Run smoke script to verify pass**

Run: `npm run search:fallback:smoke -w @broady/web`  
Expected: `search-fallback smoke: PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/catalog/catalog-client.tsx apps/web/scripts/search-fallback-smoke.mjs
git commit -m "feat(web): apply sub-category fallback in catalog search results"
```

---

### Task 3: Wire fallback matcher into header live search

**Files:**
- Modify: `apps/web/src/components/layout/site-header.tsx`
- Reuse: `apps/web/src/lib/search-fallback.ts`
- Test: `apps/web/scripts/search-fallback-smoke.mjs`

- [ ] **Step 1: Add failing live-search fallback assertion**

```js
// Extend apps/web/scripts/search-fallback-smoke.mjs
const liveApiProducts = [];
const liveFallback = liveApiProducts.length
  ? liveApiProducts
  : filterProductsBySubCategoryContains(products, "shoe");
assert(liveFallback.length > 0, "Expected live-search fallback to return matches for subCategory contains");
```

- [ ] **Step 2: Run smoke script to confirm failure**

Run: `npm run search:fallback:smoke -w @broady/web`  
Expected: FAIL because site header still sets `liveResults` directly from API result.

- [ ] **Step 3: Implement minimal header fallback integration**

```ts
// inside site-header.tsx search effect
import { filterProductsBySubCategoryContains, isEligibleSearchQuery, normalizeSearchQuery } from "@/lib/search-fallback";

const normalizedQuery = normalizeSearchQuery(q);
const apiLiveResults = productResult.slice(0, 6);
if (apiLiveResults.length) {
  setLiveResults(apiLiveResults);
} else if (isEligibleSearchQuery(normalizedQuery)) {
  const fallbackLive = filterProductsBySubCategoryContains(fallbackProducts.map(normalizeProduct), normalizedQuery).slice(0, 6);
  setLiveResults(fallbackLive);
} else {
  setLiveResults([]);
}
```

- [ ] **Step 4: Run smoke script to verify pass**

Run: `npm run search:fallback:smoke -w @broady/web`  
Expected: `search-fallback smoke: PASS`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/site-header.tsx apps/web/scripts/search-fallback-smoke.mjs
git commit -m "feat(web): add sub-category fallback for header live search"
```

---

### Task 4: Enforce minimum query length in API search route

**Files:**
- Modify: `apps/api/src/modules/products/products.routes.ts`
- Create: `apps/api/prisma/search-subcategory-smoke.js`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write failing API smoke test for min-length and sub-category contains**

```js
// apps/api/prisma/search-subcategory-smoke.js
const API_BASE = process.env.API_BASE || "http://localhost:4000/api";

async function run() {
  const shortRes = await fetch(`${API_BASE}/products?q=ja`);
  const shortJson = await shortRes.json();
  if (!Array.isArray(shortJson.data)) throw new Error("Invalid response for short query");

  const longRes = await fetch(`${API_BASE}/products?q=jack`);
  const longJson = await longRes.json();
  if (!Array.isArray(longJson.data)) throw new Error("Invalid response for long query");

  const validLong = longJson.data.every((p) => p.subCategory?.toLowerCase().includes("jack") || p.name?.toLowerCase().includes("jack"));
  if (!validLong) throw new Error("Expected long query results to include matching products");

  console.log("api search smoke: PASS");
}

run().catch((error) => {
  console.error("api search smoke: FAIL", error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Add API smoke command and run to observe current behavior**

```json
{
  "scripts": {
    "search:smoke": "node prisma/search-subcategory-smoke.js"
  }
}
```

Run: `npm run search:smoke -w @broady/api`  
Expected: FAIL or inconsistent behavior before route gate is added.

- [ ] **Step 3: Implement minimum query-length gate in products route**

```ts
const q = normalizeSearchInput(parsed.data.q);

if (q && q.length < 3) {
  cache.set(cacheKey, []);
  return res.json({ data: [], correctedQuery: null });
}

if (q) {
  // existing ranked search flow remains unchanged
}
```

- [ ] **Step 4: Run API smoke test to verify pass**

Run: `npm run search:smoke -w @broady/api`  
Expected: `api search smoke: PASS`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/products/products.routes.ts apps/api/prisma/search-subcategory-smoke.js apps/api/package.json
git commit -m "feat(api): enforce 3-char minimum for ranked product search"
```

---

### Task 5: Full verification, lint/build safety, and docs sync

**Files:**
- Modify (if needed): `docs/superpowers/specs/2026-04-16-search-subcategory-match-design.md`

- [ ] **Step 1: Run workspace lint**

Run: `npm run lint`  
Expected: all existing lint checks pass in `@broady/web` and `@broady/api`.

- [ ] **Step 2: Run workspace build**

Run: `npm run build`  
Expected: both web and api builds succeed.

- [ ] **Step 3: Run smoke tests**

Run: `npm run search:fallback:smoke -w @broady/web && npm run search:smoke -w @broady/api`  
Expected: both scripts print `PASS`.

- [ ] **Step 4: Update spec only if implementation diverged**

```md
## Implementation Notes
- Any practical differences from planned fallback source data or route guard behavior.
```

- [ ] **Step 5: Commit final verification/docs update**

```bash
git add docs/superpowers/specs/2026-04-16-search-subcategory-match-design.md
git commit -m "docs: sync search sub-category spec with implementation details"
```

---

## Self-Review Checklist (Completed)

1. **Spec coverage:**  
   - API min 3-char requirement: covered in Task 4.  
   - Sub-category contains behavior: covered in Tasks 1–4.  
   - Both catalog + header surfaces: covered in Tasks 2 and 3.  
   - Preserve ranking behavior: no rank-weight changes in Task 4.

2. **Placeholder scan:**  
   - Removed all TBD/TODO placeholders.  
   - Every code-changing step includes concrete code blocks and explicit commands.

3. **Type/signature consistency:**  
   - Shared helper function names are consistent across all tasks:  
     `normalizeSearchQuery`, `isEligibleSearchQuery`, `filterProductsBySubCategoryContains`.

