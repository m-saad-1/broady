# Search by Sub-Category Partial Match Design

## Problem
Search currently fails to consistently render products when a user enters text that should match a product sub-category (partial word/alphabet sequence). The issue appears in both:
- catalog results (`/catalog?q=...`)
- header live search results

The required behavior is:
- match sub-category using **contains** logic
- require at least **3 characters** in query text
- keep existing ranking behavior (no extra boost for sub-category matches over name matches)

## Proposed Approach (Hybrid)
Use a hybrid approach:
1. **Backend guarantee** in product search to ensure sub-category contains matching is reliably part of the search criteria for text queries of length 3+.
2. **Frontend guard** in both catalog and header live results so if API returns empty for query length 3+, fallback filtering still renders products whose `subCategory` contains the query.

This keeps behavior consistent across surfaces while avoiding UX dead-ends in edge cases.

## Architecture and Component Changes

### 1) API search route
File: `apps/api/src/modules/products/products.routes.ts`

- Keep ranked-search architecture as source of truth.
- Enforce text-search minimum query length of 3 for free-text branch.
- Ensure sub-category `contains` matching remains explicit and reliable in match conditions.

### 2) Catalog API client
File: `apps/web/src/lib/api.ts`

- Keep API contract unchanged.
- Continue returning API data for active filters/search.
- Do not embed UI-specific search fallback logic here.

### 3) Catalog UI fallback guard
File: `apps/web/src/app/catalog/catalog-client.tsx`

- When route query `q` has length >= 3 and fetched result list is empty:
  - run local fallback on available normalized products
  - include product when `product.subCategory.toLowerCase().includes(queryLower)`
- Render fallback result list instead of immediate empty state.

### 4) Header live-search fallback guard
File: `apps/web/src/components/layout/site-header.tsx`

- During live search (query length >= 3), if `getProducts({ q, ... })` returns empty:
  - apply same local sub-category contains fallback
  - render fallback list in live results panel

## Data Flow
1. User enters query in header search or reaches catalog with `q`.
2. Query (length >= 3) is sent to `/products`.
3. API ranked search returns matching products where sub-category contains query text.
4. If API returns empty, UI fallback checks local product data with same sub-category contains logic.
5. UI renders resulting products; if none found, existing empty-state copy remains.

## Error Handling and Edge Cases
- Query length < 3: do not run free-text fallback matching; keep current minimal-query behavior.
- API failure:
  - catalog/header fallback still uses available local data paths where applicable.
- No matches after API + fallback:
  - keep current empty-state messaging.

## Testing Strategy
- API search tests:
  - 2-char query does not trigger text-search rendering behavior.
  - 3+ char partial sub-category queries return expected products.
- Catalog behavior tests:
  - query matching sub-category partial renders products.
  - empty-state only appears when both API and fallback produce no results.
- Header live-search behavior tests:
  - matching sub-category partial renders live product rows.
  - fallback path works when API returns empty.

## Out of Scope
- Reordering ranking weights to prioritize sub-category over product name.
- Expanding search to new fields beyond current scope.
