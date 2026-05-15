# Meilisearch Complete Setup & Data Structure

**Last Updated:** May 2026  
**Status:** Production-Ready Configuration

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Connection & Authentication](#connection--authentication)
3. [Data Structure & Schema](#data-structure--schema)
4. [Index Configuration](#index-configuration)
5. [Search Configuration](#search-configuration)
6. [Filters & Faceting](#filters--faceting)
7. [Ranking & Sorting](#ranking--sorting)
8. [Sample Data (Ready for Upload)](#sample-data-ready-for-upload)
9. [Integration Guide](#integration-guide)
10. [Verification Checklist](#verification-checklist)

---

## Quick Start

### 1. Environment Setup

Add to `apps/api/.env`:

```bash
# For Meilisearch Cloud:
MEILISEARCH_DATABASE_URL=https://ms-<project-id>.<region>.meilisearch.io
MEILISEARCH_ADMIN_API_KEY=<your-admin-api-key>
MEILISEARCH_SEARCH_API_KEY=<your-search-api-key>
MEILISEARCH_CHAT_API_KEY=<your-chat-api-key>

# For local development:
MEILISEARCH_URL=http://127.0.0.1:7700
MEILI_MASTER_KEY=<your-master-key>
```

### 2. Initialize Index

```bash
# From repository root
npm run search:meili:sync -w @broady/api
```

This command:
- Creates the `products` index if it doesn't exist
- Applies all settings (searchable attributes, filters, ranking rules)
- Indexes all products from PostgreSQL into Meilisearch

### 3. Verify Connection

```bash
# Test health endpoint
curl http://localhost:4000/api/health

# Test search endpoint
curl "http://localhost:4000/api/products/search?q=jeans"
```

---

## Connection & Authentication

### Meilisearch Cloud Setup

**Step 1: Create Project**
- Log in to [Meilisearch Cloud](https://cloud.meilisearch.com)
- Create new project
- Copy the **Database URL** (format: `https://ms-<id>.<region>.meilisearch.io`)

**Step 2: Get API Keys**
- Navigate to **Project → Settings → API Keys**
- Copy these three keys:
  - **Default Admin API Key** → `MEILISEARCH_ADMIN_API_KEY`
  - **Default Search API Key** → `MEILISEARCH_SEARCH_API_KEY`  
  - **Chat Key** (if available) → `MEILISEARCH_CHAT_API_KEY`

**Step 3: Update .env**

```bash
MEILISEARCH_DATABASE_URL=https://ms-<project-id>.<region>.meilisearch.io
MEILISEARCH_ADMIN_API_KEY=xxxxxxxxxxxxxxxxxxxx
MEILISEARCH_SEARCH_API_KEY=yyyyyyyyyyyyyyyyyyyy
MEILISEARCH_CHAT_API_KEY=zzzzzzzzzzzzzzzzzzzz
```

### Local Development Setup

```bash
# Install Meilisearch binary (macOS/Linux/Windows)
npm run meilisearch:install

# Start local instance
npm run meilisearch:dev
```

**Key Points:**
- Cloud API keys **only work with Cloud URLs** (not localhost)
- Local keys (master key) **only work with localhost**
- Use exact URL format from Cloud settings, not `cloud.meilisearch.com`

---

## Data Structure & Schema

### Document Fields

Every indexed product document contains:

| Field | Type | Source | Purpose | Filterable | Sortable | Searchable |
|-------|------|--------|---------|-----------|----------|-----------|
| `id` | string | `Product.id` | Primary key, upsert target | — | — | — |
| `name` | string | `Product.name` | Product title | — | — | ✅ |
| `slug` | string | `Product.slug` | URL-friendly identifier | — | — | ✅ |
| `description` | string | `Product.description` | Full product description | — | — | ✅ |
| `searchDocument` | string | `Product.searchDocument` | Denormalized search text | — | — | ✅ |
| `brandId` | string | `Product.brandId` | Brand identifier | ✅ | — | — |
| `brandName` | string | `Brand.name` | Brand display name | — | — | ✅ |
| `brandSlug` | string | `Brand.slug` | Brand URL identifier | ✅ | — | ✅ |
| `pricePkr` | number | `Product.pricePkr` | Price in PKR | ✅ | ✅ | — |
| `topCategory` | string | `Product.topCategory` | Main category (Men, Women, Kids) | ✅ | — | ✅ |
| `subCategory` | string | `Product.subCategory` | Specific category (Jeans, Shirts) | ✅ | — | ✅ |
| `sizes` | string[] | `Product.sizes` | Available sizes | ✅ | — | — |
| `imageUrl` | string | `Product.imageUrl` | Primary product image | — | — | — |
| `stock` | number | `Product.stock` | Units in stock | ✅ | ✅ | — |
| `isActive` | boolean | `Product.isActive` | Product visibility toggle | ✅ | — | — |
| `approvalStatus` | string | `Product.approvalStatus` | DRAFT/PENDING/APPROVED/REJECTED | ✅ | — | — |
| `createdAt` | number | `Product.createdAt` (Unix seconds) | Creation timestamp | — | ✅ | — |
| `updatedAt` | number | `Product.updatedAt` (Unix seconds) | Last modification timestamp | — | ✅ | — |
| `averageRating` | number | `ProductReviewAggregate.averageRating` | Average review score (0-5) | — | ✅ | — |
| `totalReviews` | number | `ProductReviewAggregate.totalReviews` | Total review count | — | ✅ | — |

### Data Type Mapping

```
PostgreSQL Type     →     Meilisearch Type
VARCHAR             →     String
INT                 →     Integer
FLOAT               →     Float
BOOLEAN             →     Boolean
DATE/TIMESTAMP      →     Integer (Unix seconds)
ENUM                →     String (enum value)
TEXT[]              →     Array of Strings
JSON                →     (Not indexed)
```

### Category Structure

**Top-Level Categories (Expanded):**
- **Men**: T-Shirts, Polo Shirts, V-Neck, Formal Shirts, Hoodies, Sweatshirts, Clothing, Outerwear
- **Women**: Similar structure for women's apparel
- **Kids**: Children's clothing variants
- **Footwear**: Slip Ons, Sneakers, Boots, Sandals, Loafers
- **Accessories**: Bags, Belts, Caps, Jewelry

---

## Index Configuration

### Index Creation (Automatic)

The `search:meili:sync` script automatically:

1. **Creates index** with UID: `products`
2. **Sets primary key**: `id`
3. **Applies all settings** (see below)
4. **Waits for indexing** tasks to complete

### Index Settings Applied

```javascript
{
  // Field searching configuration
  searchableAttributes: [
    "name",           // Product name (highest priority)
    "description",    // Full description
    "searchDocument", // Denormalized search text
    "brandName",      // Brand name search
    "slug",           // Product slug
    "brandSlug",      // Brand slug
    "topCategory",    // Category search
    "subCategory"     // Subcategory search
  ],

  // Fields available for filtering (CRITICAL)
  filterableAttributes: [
    "brandId",        // Filter by exact brand ID
    "brandSlug",      // Filter by brand slug
    "topCategory",    // Filter by main category
    "subCategory",    // Filter by subcategory
    "pricePkr",       // Price range filtering
    "isActive",       // Active/inactive status
    "approvalStatus", // Only show APPROVED
    "stock",          // In-stock filtering
    "sizes"           // Size availability
  ],

  // Attributes available for sorting
  sortableAttributes: [
    "pricePkr",       // Sort by price
    "createdAt",      // Sort by newest
    "updatedAt",      // Sort by recently updated
    "averageRating",  // Sort by rating
    "totalReviews",   // Sort by popularity
    "stock"           // Sort by stock availability
  ],

  // Fields returned in search results
  displayedAttributes: [
    "id",
    "name",
    "slug",
    "description",
    "searchDocument",
    "brandId",
    "brandName",
    "brandSlug",
    "pricePkr",
    "topCategory",
    "subCategory",
    "sizes",
    "imageUrl",
    "stock",
    "isActive",
    "approvalStatus",
    "createdAt",
    "updatedAt",
    "averageRating",
    "totalReviews"
  ],

  // Ranking algorithm (order matters)
  rankingRules: [
    "words",      // Relevance: matching words
    "typo",       // Typo tolerance (1-2 character diff)
    "proximity",  // How close words are to each other
    "attribute",  // Which attribute matches
    "sort",       // Applied sort order
    "exactness"   // Exact matches rank higher
  ],

  // Typo tolerance (fuzzy matching)
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 5,     // Words with 5+ chars allow 1 typo
      twoTypos: 9     // Words with 9+ chars allow 2 typos
    }
  },

  // Pagination limits
  pagination: {
    maxTotalHits: 10000  // Max results returnable
  }
}
```

---

## Search Configuration

### Basic Search Query

```typescript
// Search with default ranking
GET /api/products/search?q=black+jeans

Response: Returns up to 100 products matching "black jeans"
```

### Advanced Search with Filters

```typescript
// Search with multiple filters
GET /api/products/search?q=jeans&brand=outfitters&category=Men&minPrice=2000&maxPrice=5000

// Returns products where:
// - Text matches "jeans"
// - Brand slug = "outfitters"
// - Top category = "Men"
// - Price between 2000-5000 PKR
```

### Filter Syntax (Meilisearch Filter Language)

```
// Exact match
brandSlug = "outfitters"

// Numeric range
pricePkr >= 2000 AND pricePkr <= 5000

// Multiple options (OR)
(topCategory = "Men" OR topCategory = "Women")

// Array contains
sizes = "M"

// Boolean
isActive = true

// Enum value
approvalStatus = "APPROVED"

// Combined filters (AND is implicit)
isActive = true AND approvalStatus = "APPROVED" AND pricePkr >= 2000
```

### Search Result Format

```json
{
  "hits": [
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
      "imageUrl": "https://cdn.example.com/product-123.jpg",
      "stock": 12,
      "isActive": true,
      "approvalStatus": "APPROVED",
      "createdAt": 1710000000,
      "updatedAt": 1710000000,
      "averageRating": 4.5,
      "totalReviews": 24
    }
  ],
  "query": "slim jeans",
  "processingTimeMs": 45,
  "limit": 100,
  "offset": 0,
  "estimatedTotalHits": 342
}
```

---

## Filters & Faceting

### Supported Filters

#### 1. **Brand Filter**
```
Filter: brandSlug = "outfitters"
Usage: Show only products from Outfitters brand
```

#### 2. **Category Filters**
```
// Single category
Filter: topCategory = "Men"

// Multiple categories (OR)
Filter: (topCategory = "Men" OR topCategory = "Women")

// Subcategory
Filter: subCategory = "Jeans"
```

#### 3. **Price Range Filter**
```
// Minimum price
Filter: pricePkr >= 2000

// Maximum price
Filter: pricePkr <= 5000

// Range (minimum AND maximum)
Filter: pricePkr >= 2000 AND pricePkr <= 5000
```

#### 4. **Size Filter**
```
Filter: sizes = "M"
Filter: sizes = "32"
Filter: (sizes = "M" OR sizes = "L")
```

#### 5. **Stock Filter**
```
// Only in-stock products
Filter: stock > 0

// Out of stock
Filter: stock = 0
```

#### 6. **Approval Filter**
```
// Only approved products (REQUIRED for storefront)
Filter: approvalStatus = "APPROVED"
```

#### 7. **Active Filter**
```
// Only active products
Filter: isActive = true
```

### Standard Filters Applied Automatically

All storefront searches include these filters:

```
isActive = true AND approvalStatus = "APPROVED"
```

Only APPROVED and ACTIVE products appear in search results.

---

## Ranking & Sorting

### Ranking Rules

The index applies these rules in order to rank results:

1. **Words** (Relevance)
   - Products with more matching words rank higher

2. **Typo** (Fuzzy Matching)
   - If exact word not found, typo-tolerant matches rank lower

3. **Proximity** (Word Distance)
   - Products where query words are close together rank higher

4. **Attribute** (Field Match Priority)
   - Matches in `name` > `description` > `searchDocument`

5. **Sort** (Applied Sort Order)
   - If sorting by price/rating/date, applied at this level

6. **Exactness** (Exact Matches)
   - Exact word matches rank above partial matches

### Sort Options

```typescript
// Sort by price (ascending - cheapest first)
sort=["pricePkr:asc"]

// Sort by price (descending - most expensive first)
sort=["pricePkr:desc"]

// Sort by newest
sort=["createdAt:desc"]

// Sort by rating
sort=["averageRating:desc"]

// Sort by popularity
sort=["totalReviews:desc"]

// Multiple sorts
sort=["approvalStatus:asc", "pricePkr:asc"]
```

### Example: Complex Sort Query

```
GET /api/products/search?q=jeans&sort=pricePkr:asc

// Returns jeans sorted cheapest to most expensive
```

---

## Sample Data (Ready for Upload)

### Sample Document 1: Premium Denim Jeans

```json
{
  "id": "prod_clx0000000000000000000001",
  "name": "Premium Slim Fit Denim Jeans",
  "slug": "outfitters-premium-slim-fit-denim",
  "description": "High-quality mid-rise slim fit jeans in premium stretch denim fabric. Perfect for casual and semi-formal occasions.",
  "searchDocument": "jeans denim slim fit men outfitters premium casual",
  "brandId": "brand_clxbrand0000000000000001",
  "brandName": "Outfitters",
  "brandSlug": "outfitters",
  "pricePkr": 4999,
  "topCategory": "Men",
  "subCategory": "Jeans",
  "sizes": ["28", "30", "32", "34", "36"],
  "imageUrl": "https://cdn.broady.pk/products/outfitters-premium-jeans-001.jpg",
  "stock": 45,
  "isActive": true,
  "approvalStatus": "APPROVED",
  "createdAt": 1710000000,
  "updatedAt": 1720000000,
  "averageRating": 4.7,
  "totalReviews": 156
}
```

### Sample Document 2: Casual Polo Shirt

```json
{
  "id": "prod_clx0000000000000000000002",
  "name": "Classic Casual Polo Shirt",
  "slug": "brandname-classic-casual-polo-shirt",
  "description": "Comfortable cotton blend polo shirt perfect for casual wear. Available in multiple colors.",
  "searchDocument": "polo shirt casual cotton men clothing comfortable",
  "brandId": "brand_clxbrand0000000000000002",
  "brandName": "Brand Name",
  "brandSlug": "brandname",
  "pricePkr": 2499,
  "topCategory": "Men",
  "subCategory": "Polo Shirts",
  "sizes": ["S", "M", "L", "XL", "XXL"],
  "imageUrl": "https://cdn.broady.pk/products/brandname-polo-001.jpg",
  "stock": 120,
  "isActive": true,
  "approvalStatus": "APPROVED",
  "createdAt": 1705000000,
  "updatedAt": 1718000000,
  "averageRating": 4.3,
  "totalReviews": 89
}
```

### Sample Document 3: Sports Sneakers

```json
{
  "id": "prod_clx0000000000000000000003",
  "name": "Lightweight Sports Sneakers",
  "slug": "athletico-lightweight-sports-sneakers",
  "description": "Breathable sports sneakers with cushioned sole for all-day comfort. Ideal for running and casual activities.",
  "searchDocument": "sneakers sports running athletic footwear shoes comfortable",
  "brandId": "brand_clxbrand0000000000000003",
  "brandName": "Athletico",
  "brandSlug": "athletico",
  "pricePkr": 5999,
  "topCategory": "Footwear",
  "subCategory": "Sneakers",
  "sizes": ["6", "7", "8", "9", "10", "11", "12"],
  "imageUrl": "https://cdn.broady.pk/products/athletico-sneakers-001.jpg",
  "stock": 67,
  "isActive": true,
  "approvalStatus": "APPROVED",
  "createdAt": 1708000000,
  "updatedAt": 1719000000,
  "averageRating": 4.8,
  "totalReviews": 234
}
```

### Sample Document 4: Women's Casual Dress

```json
{
  "id": "prod_clx0000000000000000000004",
  "name": "Elegant Casual Summer Dress",
  "slug": "elegance-elegant-casual-summer-dress",
  "description": "Perfect summer dress with breathable fabric and elegant design. Comfortable for all-day wear.",
  "searchDocument": "dress women casual summer elegant breathable fashion",
  "brandId": "brand_clxbrand0000000000000004",
  "brandName": "Elegance",
  "brandSlug": "elegance",
  "pricePkr": 3499,
  "topCategory": "Women",
  "subCategory": "Dresses",
  "sizes": ["XS", "S", "M", "L", "XL"],
  "imageUrl": "https://cdn.broady.pk/products/elegance-dress-001.jpg",
  "stock": 82,
  "isActive": true,
  "approvalStatus": "APPROVED",
  "createdAt": 1706000000,
  "updatedAt": 1717000000,
  "averageRating": 4.6,
  "totalReviews": 178
}
```

### Sample Document 5: Kids' Winter Hoodie

```json
{
  "id": "prod_clx0000000000000000000005",
  "name": "Cozy Winter Kids Hoodie",
  "slug": "kidzone-cozy-winter-kids-hoodie",
  "description": "Warm and cozy hoodie perfect for winter. Soft fabric with fun designs that kids love.",
  "searchDocument": "hoodie kids children winter warm cozy clothing",
  "brandId": "brand_clxbrand0000000000000005",
  "brandName": "KidZone",
  "brandSlug": "kidzone",
  "pricePkr": 1999,
  "topCategory": "Kids",
  "subCategory": "Hoodies",
  "sizes": ["2Y", "4Y", "6Y", "8Y", "10Y", "12Y"],
  "imageUrl": "https://cdn.broady.pk/products/kidzone-hoodie-001.jpg",
  "stock": 95,
  "isActive": true,
  "approvalStatus": "APPROVED",
  "createdAt": 1704000000,
  "updatedAt": 1716000000,
  "averageRating": 4.5,
  "totalReviews": 112
}
```

### Bulk Upload JSON (All Samples)

```json
[
  {
    "id": "prod_clx0000000000000000000001",
    "name": "Premium Slim Fit Denim Jeans",
    "slug": "outfitters-premium-slim-fit-denim",
    "description": "High-quality mid-rise slim fit jeans in premium stretch denim fabric. Perfect for casual and semi-formal occasions.",
    "searchDocument": "jeans denim slim fit men outfitters premium casual",
    "brandId": "brand_clxbrand0000000000000001",
    "brandName": "Outfitters",
    "brandSlug": "outfitters",
    "pricePkr": 4999,
    "topCategory": "Men",
    "subCategory": "Jeans",
    "sizes": ["28", "30", "32", "34", "36"],
    "imageUrl": "https://cdn.broady.pk/products/outfitters-premium-jeans-001.jpg",
    "stock": 45,
    "isActive": true,
    "approvalStatus": "APPROVED",
    "createdAt": 1710000000,
    "updatedAt": 1720000000,
    "averageRating": 4.7,
    "totalReviews": 156
  },
  {
    "id": "prod_clx0000000000000000000002",
    "name": "Classic Casual Polo Shirt",
    "slug": "brandname-classic-casual-polo-shirt",
    "description": "Comfortable cotton blend polo shirt perfect for casual wear. Available in multiple colors.",
    "searchDocument": "polo shirt casual cotton men clothing comfortable",
    "brandId": "brand_clxbrand0000000000000002",
    "brandName": "Brand Name",
    "brandSlug": "brandname",
    "pricePkr": 2499,
    "topCategory": "Men",
    "subCategory": "Polo Shirts",
    "sizes": ["S", "M", "L", "XL", "XXL"],
    "imageUrl": "https://cdn.broady.pk/products/brandname-polo-001.jpg",
    "stock": 120,
    "isActive": true,
    "approvalStatus": "APPROVED",
    "createdAt": 1705000000,
    "updatedAt": 1718000000,
    "averageRating": 4.3,
    "totalReviews": 89
  },
  {
    "id": "prod_clx0000000000000000000003",
    "name": "Lightweight Sports Sneakers",
    "slug": "athletico-lightweight-sports-sneakers",
    "description": "Breathable sports sneakers with cushioned sole for all-day comfort. Ideal for running and casual activities.",
    "searchDocument": "sneakers sports running athletic footwear shoes comfortable",
    "brandId": "brand_clxbrand0000000000000003",
    "brandName": "Athletico",
    "brandSlug": "athletico",
    "pricePkr": 5999,
    "topCategory": "Footwear",
    "subCategory": "Sneakers",
    "sizes": ["6", "7", "8", "9", "10", "11", "12"],
    "imageUrl": "https://cdn.broady.pk/products/athletico-sneakers-001.jpg",
    "stock": 67,
    "isActive": true,
    "approvalStatus": "APPROVED",
    "createdAt": 1708000000,
    "updatedAt": 1719000000,
    "averageRating": 4.8,
    "totalReviews": 234
  },
  {
    "id": "prod_clx0000000000000000000004",
    "name": "Elegant Casual Summer Dress",
    "slug": "elegance-elegant-casual-summer-dress",
    "description": "Perfect summer dress with breathable fabric and elegant design. Comfortable for all-day wear.",
    "searchDocument": "dress women casual summer elegant breathable fashion",
    "brandId": "brand_clxbrand0000000000000004",
    "brandName": "Elegance",
    "brandSlug": "elegance",
    "pricePkr": 3499,
    "topCategory": "Women",
    "subCategory": "Dresses",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "imageUrl": "https://cdn.broady.pk/products/elegance-dress-001.jpg",
    "stock": 82,
    "isActive": true,
    "approvalStatus": "APPROVED",
    "createdAt": 1706000000,
    "updatedAt": 1717000000,
    "averageRating": 4.6,
    "totalReviews": 178
  },
  {
    "id": "prod_clx0000000000000000000005",
    "name": "Cozy Winter Kids Hoodie",
    "slug": "kidzone-cozy-winter-kids-hoodie",
    "description": "Warm and cozy hoodie perfect for winter. Soft fabric with fun designs that kids love.",
    "searchDocument": "hoodie kids children winter warm cozy clothing",
    "brandId": "brand_clxbrand0000000000000005",
    "brandName": "KidZone",
    "brandSlug": "kidzone",
    "pricePkr": 1999,
    "topCategory": "Kids",
    "subCategory": "Hoodies",
    "sizes": ["2Y", "4Y", "6Y", "8Y", "10Y", "12Y"],
    "imageUrl": "https://cdn.broady.pk/products/kidzone-hoodie-001.jpg",
    "stock": 95,
    "isActive": true,
    "approvalStatus": "APPROVED",
    "createdAt": 1704000000,
    "updatedAt": 1716000000,
    "averageRating": 4.5,
    "totalReviews": 112
  }
]
```

---

## Integration Guide

### 1. Web Frontend Integration

#### Search Endpoint (Next.js)

```typescript
// File: apps/web/src/lib/api.ts
export async function searchProducts(q: string, filters?: SearchFilters) {
  const params = new URLSearchParams({ q });
  
  if (filters?.brand) params.append("brand", filters.brand);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.minPrice) params.append("minPrice", String(filters.minPrice));
  if (filters?.maxPrice) params.append("maxPrice", String(filters.maxPrice));
  if (filters?.size) params.append("size", filters.size);
  
  const res = await fetch(`/api/products/search?${params}`);
  return res.json();
}
```

#### Search Component

```typescript
// Usage in components
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);

const handleSearch = async (query: string) => {
  setLoading(true);
  const data = await searchProducts(query, {
    category: selectedCategory,
    minPrice: minPrice,
    maxPrice: maxPrice
  });
  setResults(data.hits);
  setLoading(false);
};
```

### 2. API Search Route

```typescript
// File: apps/api/src/modules/products/products.routes.ts

router.get("/search", async (req, res) => {
  const q = req.query.q as string;
  const filters = {
    brand: req.query.brand as string,
    category: req.query.category as string,
    minPrice: parseInt(req.query.minPrice as string) || undefined,
    maxPrice: parseInt(req.query.maxPrice as string) || undefined,
  };
  
  try {
    const productIds = await runMeilisearchProductSearch(q, filters);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true, reviewAggregate: true }
    });
    res.json({ hits: products, query: q });
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});
```

### 3. Real-time Index Updates

When products are created/updated in the admin panel:

```typescript
// After product is saved to database
async function syncProductToMeilisearch(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, reviewAggregate: true }
  });
  
  if (!product) return;
  
  const client = createMeiliSearch("admin");
  const index = client.index("products");
  const doc = mapProductToMeiliDocument(product);
  
  await index.updateDocuments([doc]);
}
```

### 4. Batch Sync (Full Reindex)

```bash
# Syncs all products to Meilisearch (from repo root)
npm run search:meili:sync -w @broady/api

# This command:
# 1. Connects to PostgreSQL via DATABASE_URL
# 2. Fetches all products with brands and reviews
# 3. Indexes them in chunks of 500
# 4. Waits for indexing to complete
```

---

## Verification Checklist

### Pre-Deployment

- [ ] Meilisearch Cloud project created and URL copied
- [ ] API keys (admin, search, chat) generated and stored securely
- [ ] `.env` file updated with all Meilisearch credentials
- [ ] Database connection verified (`DATABASE_URL` working)
- [ ] Local test: `npm run search:meili:sync` completes successfully
- [ ] Sample products indexed in Meilisearch
- [ ] Search endpoint returns results: `GET /api/products/search?q=test`
- [ ] Filters working: `GET /api/products/search?q=test&category=Men&minPrice=1000`
- [ ] Sorting working: `GET /api/products/search?q=test&sort=pricePkr:asc`

### Production Deployment

- [ ] Cloud credentials never exposed in code or git history
- [ ] `.env` file is `.gitignore`'d
- [ ] Admin API key restricted to necessary operations only
- [ ] Search API key has read-only permissions
- [ ] Production database has index backup (Cloud automatic)
- [ ] Load testing: Search performance under 500ms for 10K products
- [ ] Monitoring: Set up alerts for indexing failures
- [ ] Error handling: Graceful fallback if Meilisearch unavailable
- [ ] CORS enabled if calling search API from different domain

### Monitoring & Health

```bash
# Check Meilisearch health
curl https://ms-<id>.<region>.meilisearch.io/health

# Check product index status
curl https://ms-<id>.<region>.meilisearch.io/indexes/products \
  -H "Authorization: Bearer <admin-key>"

# Check recent tasks
curl https://ms-<id>.<region>.meilisearch.io/tasks \
  -H "Authorization: Bearer <admin-key>"
```

---

## Performance Optimization

### Search Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| Search latency (p50) | < 100ms | 45ms |
| Search latency (p95) | < 300ms | 150ms |
| Index size (10K products) | < 50MB | 35MB |
| Indexing speed | 1000 docs/sec | 1500 docs/sec |

### Optimization Tips

1. **Use searchableAttributes wisely**
   - Include only fields that need full-text search
   - Reduces index size and improves speed

2. **Set appropriate filterableAttributes**
   - Index only fields used in filters
   - Enables faster range queries

3. **Batch updates**
   - Use `updateDocuments()` in batches of 500-1000
   - Never send single documents in production

4. **Monitor index size**
   - Run reindex monthly to clean up deleted products
   - Archive old snapshots

5. **Cache search results**
   - Cache top 100 queries in Redis
   - Reduce redundant Meilisearch calls

---

## Troubleshooting

### Common Issues

#### 1. "invalid_api_key"
**Cause:** Cloud API key used with localhost or vice versa  
**Solution:** Use Cloud URLs with Cloud keys; use localhost with local keys

#### 2. "index does not exist"
**Cause:** Index wasn't created  
**Solution:** Run `npm run search:meili:sync`

#### 3. "No results for valid query"
**Cause:** Products not indexed or filtered out  
**Solution:** Check `approvalStatus = "APPROVED"` and `isActive = true`

#### 4. "Search timeout"
**Cause:** Index too large or Meilisearch overloaded  
**Solution:** Optimize searchable attributes; add pagination

#### 5. "Connection refused"
**Cause:** Meilisearch not running  
**Solution:** Start with `npm run meilisearch:dev` or verify Cloud URL

---

## Summary

This complete Meilisearch setup provides:

✅ **Fast Search** - < 100ms average response time  
✅ **Accurate Results** - Smart ranking with typo tolerance  
✅ **Production-Ready** - Cloud-hosted, scalable, reliable  
✅ **Easy Integration** - Pre-configured filters, sorting, ranking  
✅ **Complete Documentation** - Data structure, examples, troubleshooting  

All sample data is ready for upload and immediately indexable in Meilisearch.
