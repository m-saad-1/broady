# Meilisearch Complete Implementation Guide

## ✅ Current Status

- ✅ `.env` configured with Meilisearch settings (keys placeholders added)
- ✅ Factory functions implemented (`createMeiliSearch()`, `resolveMeilisearchApiKey()`)
- ✅ Index configuration defined (18-field schema with search/filter/sort settings)
- ✅ Product mapping implemented (Prisma to Meilisearch document conversion)
- ✅ Search routes wired (`GET /api/products/` with Meilisearch fallback)
- ✅ Suggest route wired (`GET /api/products/suggest`)
- ✅ Database health checks implemented
- ⏳ Product extraction script ready (blocked by DB connection)
- ⏳ JSON export file (ready once DB is up)

---

## 🚀 STEP 1: Start PostgreSQL Database

### Option A: Windows PostgreSQL Service (Recommended if installed)

```powershell
# Check PostgreSQL service status
Get-Service postgresql-x64-* -ErrorAction SilentlyContinue | Select-Object Name, Status

# Start the service (replace with actual service name)
Start-Service postgresql-x64-16  # Example for PostgreSQL 16
# Or use Services GUI: press Win+R → services.msc → find postgresql → Right-click → Start
```

### Option B: Docker (if installed)

```bash
npm run db:up
# Waits for postgres:15 and redis services
```

### Option C: Manual PostgreSQL Installation

If PostgreSQL is not installed:
1. Download from https://www.postgresql.org/download/windows/
2. Install with credentials: `postgres` / `postgre123`
3. Ensure it runs on `localhost:5432`
4. Create database: `CREATE DATABASE broady;`

### Verify DB Connection

```bash
# Test connection
psql -U postgres -d broady -h localhost -c "SELECT version();"

# Should return: PostgreSQL 15.x on... (or current version)
```

---

## 📦 STEP 2: Extract All Products from Database

Once PostgreSQL is running:

```bash
# From repository root
node extract-products.js
```

### Expected Output

```
Fetching all products from database...
✅ Extracted 42 products successfully
📄 JSON export saved to: docs/MEILISEARCH_PRODUCTS_EXPORT.json
```

### Output File Structure

The `docs/MEILISEARCH_PRODUCTS_EXPORT.json` contains an array of products in Meilisearch format:

```json
[
  {
    "id": "product-uuid-1",
    "name": "Classic Cotton T-Shirt",
    "slug": "classic-cotton-t-shirt",
    "description": "Premium quality cotton t-shirt...",
    "searchDocument": "cotton t-shirt premium quality...",
    "brandId": "brand-uuid-1",
    "brandName": "BrandName",
    "brandSlug": "brandname",
    "pricePkr": 1999,
    "topCategory": "Men",
    "subCategory": "T-Shirts",
    "sizes": ["S", "M", "L", "XL"],
    "imageUrl": "/uploads/products/...",
    "stock": 50,
    "isActive": true,
    "approvalStatus": "APPROVED",
    "createdAt": 1700000000,
    "updatedAt": 1700000000,
    "averageRating": 4.5,
    "totalReviews": 12
  },
  // ... more products
]
```

---

## 🔐 STEP 3: Configure Meilisearch API Keys

### For Local Development

1. **Install & Start Meilisearch Binary** (optional for dev)
   ```bash
   # Windows - Download from https://github.com/meilisearch/meilisearch/releases
   # Or use Windows Package Manager
   choco install meilisearch
   
   # Start server (runs on http://127.0.0.1:7700 by default)
   meilisearch
   ```

2. **Get Local Master Key** (first time setup)
   ```bash
   # Meilisearch will display master key in console on first run
   # If no master key provided, it generates one: MEILI_MASTER_KEY=xxxxx
   ```

3. **Update `.env` for Local Dev**
   ```env
   MEILISEARCH_URL=http://127.0.0.1:7700
   MEILI_MASTER_KEY=your-local-master-key-from-console
   MEILISEARCH_ENABLE_PRODUCT_SEARCH=true
   ```

### For Production (Cloud)

1. **Sign Up at Meilisearch Cloud**
   - Visit https://cloud.meilisearch.com
   - Create a project
   - Note the **Database URL** (https://ms-xxxxx.meilisearch.io)

2. **Create API Keys in Cloud Dashboard**
   - **Admin API Key**: Can create/delete indexes, manage settings
   - **Search API Key**: Read-only, for search queries (safer for frontend)
   - **Chat API Key**: For AI integrations

3. **Update `.env` for Production**
   ```env
   # Production Meilisearch Cloud
   MEILISEARCH_DATABASE_URL=https://ms-xxxxx.meilisearch.io
   MEILISEARCH_ADMIN_API_KEY=your-admin-key-from-cloud
   MEILISEARCH_SEARCH_API_KEY=your-search-key-from-cloud
   MEILISEARCH_CHAT_API_KEY=your-chat-key-from-cloud
   MEILISEARCH_ENABLE_PRODUCT_SEARCH=true
   ```

---

## 📤 STEP 4: Upload Products to Meilisearch

### Method A: Via Dashboard (Easiest)

1. **Local**: Open http://127.0.0.1:7700/
2. **Cloud**: Login to https://cloud.meilisearch.com/
3. Go to **Indexes** → **Create Index** → **"products"**
4. Click **Upload Documents** → Select `docs/MEILISEARCH_PRODUCTS_EXPORT.json`
5. Set **Primary Key** to `id`
6. Click **Upload**

### Method B: Via API (CLI)

```bash
# Using curl
curl -X POST 'http://127.0.0.1:7700/indexes/products/documents' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-master-key' \
  -d @docs/MEILISEARCH_PRODUCTS_EXPORT.json

# Or for Cloud
curl -X POST 'https://ms-xxxxx.meilisearch.io/indexes/products/documents' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-admin-api-key' \
  -d @docs/MEILISEARCH_PRODUCTS_EXPORT.json
```

### Method C: Via Node.js Script

```bash
# Create and run upload script
node -e "
const { MeiliSearch } = require('meilisearch');
const fs = require('fs');

const client = new MeiliSearch({
  host: 'http://127.0.0.1:7700',
  apiKey: 'your-master-key'
});

const docs = JSON.parse(fs.readFileSync('docs/MEILISEARCH_PRODUCTS_EXPORT.json'));
client.index('products').addDocuments(docs)
  .then(() => console.log('✅ Documents uploaded'))
  .catch(e => console.error('❌ Error:', e));
"
```

---

## 🔍 STEP 5: Verify Meilisearch Integration

### Health Check

```bash
# Check if Meilisearch is accessible
curl http://127.0.0.1:7700/health
# Should return: { "status": "available" }

# Or via Node.js
node -e "
const { MeiliSearch } = require('meilisearch');
const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
client.isHealthy().then(h => console.log('✅ Healthy:', h));
"
```

### Index Status

```bash
# Check if products index exists and has documents
curl 'http://127.0.0.1:7700/indexes/products/stats' \
  -H 'Authorization: Bearer your-master-key'

# Expected response:
# {
#   "numberOfDocuments": 42,
#   "isIndexing": false,
#   "fieldDistribution": { ... }
# }
```

### Test Search via API

```bash
# Start Broady API
npm run dev -w @broady/api

# Test search endpoint
curl 'http://localhost:4000/api/products?q=shirt&topCategory=Men' \
  -H 'Accept: application/json'

# Should return products matching "shirt" filter
```

### Test Search via Web UI

```bash
# Start web and API
npm run dev

# Open http://localhost:3000/catalog
# Search for "shirt" or "t-shirt"
# Should show Meilisearch results (fast & typo-tolerant)
```

---

## 🛠️ Configuration Reference

### `.env` Variables

| Variable | Purpose | Example | Local Dev | Production |
|----------|---------|---------|-----------|------------|
| `MEILISEARCH_URL` | Local instance URL | `http://127.0.0.1:7700` | ✅ | ❌ |
| `MEILISEARCH_DATABASE_URL` | Cloud instance URL | `https://ms-xxxxx.meilisearch.io` | ❌ | ✅ |
| `MEILI_MASTER_KEY` | Local master key (all permissions) | From console | ✅ | ❌ |
| `MEILISEARCH_ADMIN_API_KEY` | Cloud admin key | From dashboard | ❌ | ✅ |
| `MEILISEARCH_SEARCH_API_KEY` | Cloud search key (frontend safe) | From dashboard | ❌ | ✅ |
| `MEILISEARCH_CHAT_API_KEY` | Cloud AI chat key | From dashboard | ❌ | ✅ |
| `MEILISEARCH_ENABLE_PRODUCT_SEARCH` | Enable/disable search | `true` | ✅ | ✅ |

### API Endpoints

| Endpoint | Purpose | Auth | Example Query |
|----------|---------|------|----------------|
| `GET /api/products` | Search/browse products | None | `?q=shirt&topCategory=Men&minPrice=500&maxPrice=5000` |
| `GET /api/products/suggest` | Search suggestions | None | `?q=shirt` |
| `GET /api/products/:slug` | Single product detail | None | `GET /api/products/classic-t-shirt` |
| `GET /health` | DB/service health | None | Status: `healthy`, `degraded`, `unavailable` |

### Index Settings

- **Index UID**: `products`
- **Primary Key**: `id`
- **Searchable Fields** (8): name, description, searchDocument, brandName, slug, brandSlug, topCategory, subCategory
- **Filterable Fields** (9): brandId, brandSlug, topCategory, subCategory, pricePkr, isActive, approvalStatus, stock, sizes
- **Sortable Fields** (5): pricePkr, createdAt, updatedAt, averageRating, totalReviews

---

## 🔄 Real-Time Sync (Auto-Sync on Product Changes)

When you create/update/delete products via API, Meilisearch index is automatically synced:

```bash
# Create product → Auto-synced to Meilisearch
POST /api/products
{
  "name": "New Product",
  "price": 1999,
  ...
}

# Update product → Auto-synced
PATCH /api/products/:id
{ "name": "Updated Name" }

# Delete product → Auto-removed from index
DELETE /api/products/:id
```

This happens via notification events in `products.module.ts`:
- `product.created` → Adds to Meilisearch
- `product.updated` → Updates in Meilisearch
- `product.deleted` → Removes from Meilisearch

---

## 🚨 Troubleshooting

### "Can't reach Meilisearch at localhost:7700"

**Solution**: Start Meilisearch service
```bash
# Windows
meilisearch

# Or via package manager
choco install meilisearch
```

### "Invalid API key for Meilisearch"

**Solution**: Verify `.env` has correct key
```bash
# Local development
MEILI_MASTER_KEY=xxxxx  # From Meilisearch console

# Production
MEILISEARCH_ADMIN_API_KEY=xxxxx  # From Cloud dashboard
```

### "Products index not found"

**Solution**: Create index and upload documents
```bash
# Via dashboard or API (see STEP 4)
curl -X POST 'http://127.0.0.1:7700/indexes' \
  -H 'Authorization: Bearer your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{"uid":"products","primaryKey":"id"}'
```

### Search results are stale after product updates

**Solution**: Clear cache and restart API
```bash
npm run dev -w @broady/api
# Cache is auto-cleared on product changes
```

---

## 📋 Deployment Checklist

- [ ] PostgreSQL running and accessible
- [ ] All products extracted to `docs/MEILISEARCH_PRODUCTS_EXPORT.json`
- [ ] Meilisearch service running (local or Cloud)
- [ ] Products uploaded to Meilisearch index
- [ ] `.env` configured with correct API keys
- [ ] `MEILISEARCH_ENABLE_PRODUCT_SEARCH=true`
- [ ] `/health` endpoint returns `status: healthy`
- [ ] `/api/products?q=shirt` returns results
- [ ] Web UI search at `/catalog` works
- [ ] Product create/update/delete syncs to Meilisearch

---

## 📞 Support

For issues or questions:
1. Check logs: `npm run dev` and review terminal output
2. Test health: `curl http://localhost:4000/health`
3. Verify config: Check `.env` for missing keys
4. Review Meilisearch docs: https://docs.meilisearch.com

---

**Last Updated**: [Current Date]
**Meilisearch Version**: v1.0+
**Broady API Version**: Latest
