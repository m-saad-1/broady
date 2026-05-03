# Meilisearch for Broady

This project indexes marketplace **products** in Meilisearch index UID **`products`**. The HTTP API runs at `MEILISEARCH_URL` (default `http://127.0.0.1:7700`).

## Meilisearch Cloud vs self‑hosted

If your keys come from **[Meilisearch Cloud](https://cloud.meilisearch.com)** (for example **Project → Settings → API Keys**), they are **only valid for that Cloud project’s search host**, not for `http://127.0.0.1:7700` and not for `https://cloud.meilisearch.com` (that host is the **control UI**, not the search API your app calls).

1. In Cloud, open **your project → Settings**.
2. Copy the **Database URL** / instance **HTTPS** host (shape: `https://ms-<id>.<region>.meilisearch.io` — see the [Cloud / React guide](https://www.meilisearch.com/blog/add-ai-powered-search-to-react) which shows the same pattern).
3. Set **`MEILISEARCH_URL`** or **`MEILISEARCH_DATABASE_URL`** in `apps/api/.env` to that value, together with the **Default Admin API Key** (and Search / Chat keys as needed).

You do **not** need `npm run meilisearch:dev` when using Cloud; the managed instance is already running.

For a **local** binary, use keys issued by **that** instance (or only `MEILI_MASTER_KEY` as Bearer for dev), and set `MEILISEARCH_URL=http://127.0.0.1:7700`. See [authentication](https://www.meilisearch.com/docs/reference/features/authentication).

## Keys and environment

Meilisearch issues a **master key** (server secret) and **API keys** with different scopes. Store all values in **`apps/api/.env`** (gitignored), not in committed files.

| Variable | Role |
|----------|------|
| `MEILISEARCH_DATABASE_URL` | Optional alias for the search API base URL (same value many Cloud UIs call “Database URL”). |
| `MEILI_MASTER_KEY` | Required when starting the `meilisearch` binary (see `npm run meilisearch:dev`). Must match the key the instance was first created with for that data directory. |
| `MEILISEARCH_ADMIN_API_KEY` | Server-side indexing and settings (`createMeiliSearch("admin")`, sync script). |
| `MEILISEARCH_SEARCH_API_KEY` | Search-only usage (`createMeiliSearch("search")`); use for routes that must not mutate indexes. |
| `MEILISEARCH_CHAT_API_KEY` | Meilisearch **chat** APIs (`createMeiliSearch("chat")`). |
| `MEILISEARCH_API_KEY` | Legacy fallback; treated like admin if `MEILISEARCH_ADMIN_API_KEY` is empty. |

If keys were ever pasted into chat or tickets, **rotate them** in Meilisearch and update `.env`.

## Local process (no Docker)

1. Install the binary: `npm run meilisearch:install`
2. Put `MEILI_MASTER_KEY` and API keys in `apps/api/.env`.
3. Start Meilisearch: `npm run meilisearch:dev` (loads `MEILI_MASTER_KEY` from `apps/api/.env` when unset in the shell).

**`invalid_api_key`:** (1) **Cloud:** `MEILISEARCH_URL` / `MEILISEARCH_DATABASE_URL` must be your project’s **Database URL** (`https://ms-….meilisearch.io`), not localhost. (2) **Self‑hosted:** The master key on the running process must be the one that issued your API keys for that `data.ms` directory.

## Index and primary key

- **Index UID:** `products`
- **Primary key:** `id` (Prisma `Product.id`)

Create/update index settings and upsert documents from Postgres:

```bash
npm run search:meili:sync
```

(Run from repo root; requires a working `DATABASE_URL` and Meilisearch admin credentials.)

## Document shape (each indexed object)

Every document is a JSON object. Fields map from Prisma `Product` + `Brand` + optional `ProductReviewAggregate`.

| Attribute | Type | Source | Purpose |
|-----------|------|--------|---------|
| `id` | string | `Product.id` | Primary key; upserts and deletes target this. |
| `name` | string | `Product.name` | Search, display. |
| `slug` | string | `Product.slug` | Search, routing. |
| `description` | string | `Product.description` | Search. |
| `searchDocument` | string | `Product.searchDocument` | Extra normalized search text. |
| `brandId` | string | `Product.brandId` | Filter. |
| `brandName` | string | `Brand.name` | Search, display. |
| `brandSlug` | string | `Brand.slug` | Search, filter. |
| `pricePkr` | number | `Product.pricePkr` | Filter, sort. |
| `topCategory` | string | `Product.topCategory` | Search, filter. |
| `subCategory` | string | `Product.subCategory` | Search, filter. |
| `sizes` | string[] | `Product.sizes` | Filter (array). |
| `imageUrl` | string | `Product.imageUrl` | Display. |
| `stock` | number | `Product.stock` | Filter, sort. |
| `isActive` | boolean | `Product.isActive` | Filter. |
| `approvalStatus` | string | `Product.approvalStatus` enum value | Filter (e.g. only `APPROVED` in storefront queries). |
| `createdAt` | number | `Product.createdAt` as Unix seconds UTC | Sort. |
| `updatedAt` | number | `Product.updatedAt` as Unix seconds UTC | Sort, incremental sync hints. |
| `averageRating` | number | `ProductReviewAggregate.averageRating` or `0` | Sort, display. |
| `totalReviews` | number | `ProductReviewAggregate.totalReviews` or `0` | Sort, display. |

### Example document (illustrative)

```json
{
  "id": "clx0000000000000000000001",
  "name": "Slim fit denim jeans",
  "slug": "outfitters-slim-fit-denim-jeans",
  "description": "Mid-rise slim fit jeans in stretch denim.",
  "searchDocument": "men jeans denim outfitters slim",
  "brandId": "clxbrand0000000000000001",
  "brandName": "Outfitters",
  "brandSlug": "outfitters",
  "pricePkr": 4999,
  "topCategory": "Men",
  "subCategory": "Jeans",
  "sizes": ["30", "32", "34"],
  "imageUrl": "https://example.com/image.jpg",
  "stock": 12,
  "isActive": true,
  "approvalStatus": "APPROVED",
  "createdAt": 1710000000,
  "updatedAt": 1710086400,
  "averageRating": 4.5,
  "totalReviews": 8
}
```

## Index settings (applied by code)

Defined in `apps/api/src/modules/search/meilisearch.product-document.ts`:

- **Searchable:** `name`, `description`, `searchDocument`, `brandName`, `slug`, `brandSlug`, `topCategory`, `subCategory`
- **Filterable:** `brandId`, `brandSlug`, `topCategory`, `subCategory`, `pricePkr`, `isActive`, `approvalStatus`, `stock`, `sizes`
- **Sortable:** `pricePkr`, `createdAt`, `updatedAt`, `averageRating`, `totalReviews`, `stock`
- **Displayed:** all fields listed in that file (used in search hits).

## TypeScript type

`ProductSearchDocument` is declared in `apps/api/src/modules/search/meilisearch.types.ts` and should stay in sync with this table and the mapper `mapProductToMeiliDocument`.

## Docker (optional)

`docker-compose.yml` can run Meilisearch; set `MEILI_MASTER_KEY` in a root `.env` used by Compose so it matches your API keys’ instance.
