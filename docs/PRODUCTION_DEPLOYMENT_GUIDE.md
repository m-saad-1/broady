# Broady Meilisearch: Complete Deployment Guide (Local + Production)

**Status**: ✅ All products extracted (52 products ready for upload)

---

## 📋 Quick Summary

| Component | Status | Details |
|-----------|--------|---------|
| **API** | ✅ Running | Port 4000, DB connected |
| **Database** | ✅ Connected | 52 approved products available |
| **Products Export** | ✅ Ready | `docs/MEILISEARCH_PRODUCTS_EXPORT.json` (43KB) |
| **Configuration** | ✅ In .env | Meilisearch settings with placeholders |
| **Search Routes** | ✅ Wired | `/api/products` endpoint ready |
| **Meilisearch Service** | ⏳ Pending | Local binary or Cloud instance |

---

## 🔷 ENVIRONMENT 1: LOCAL DEVELOPMENT

### Step 1: Install Meilisearch Locally

#### Option A: Windows Package Manager (Easiest)

```powershell
# Install Meilisearch using Chocolatey
choco install meilisearch

# Or using Windows Package Manager
winget install MeiliSearch.MeiliSearch
```

#### Option B: Manual Download

1. Download from https://github.com/meilisearch/meilisearch/releases
2. Extract `meilisearch.exe` to a folder
3. Add folder to PATH or run directly

#### Option C: Docker (if Docker is available)

```bash
docker run -it --rm -p 7700:7700 getmeili/meilisearch:latest meilisearch
```

### Step 2: Start Meilisearch Local Instance

```powershell
# Start with custom master key
meilisearch --master-key "my-local-dev-key-12345"

# Or with environment variable
$env:MEILI_MASTER_KEY="my-local-dev-key-12345"
meilisearch

# Server runs at: http://127.0.0.1:7700
# Dashboard at: http://127.0.0.1:7700 (displays master key)
```

### Step 3: Configure .env for Local Development

Update `d:\WEB DEVELOPMENT\broady\.env`:

```env
# --- Search (Meilisearch) - LOCAL DEVELOPMENT ---
MEILISEARCH_URL=http://127.0.0.1:7700
MEILI_MASTER_KEY=my-local-dev-key-12345
MEILISEARCH_ADMIN_API_KEY=my-local-dev-key-12345
MEILISEARCH_SEARCH_API_KEY=my-local-dev-key-12345
MEILISEARCH_CHAT_API_KEY=my-local-dev-key-12345
MEILISEARCH_ENABLE_PRODUCT_SEARCH=true

# Leave production keys empty for local dev
MEILISEARCH_DATABASE_URL=
```

### Step 4: Upload Products to Local Instance

#### Method A: Via Meilisearch Dashboard (Simplest)

1. Open http://127.0.0.1:7700/ in browser
2. Click **Create index**
3. Enter:
   - **Index UID**: `products`
   - **Primary Key**: `id`
4. Click **Create**
5. Once created, click the **products** index
6. Click **Upload Documents**
7. Select `docs/MEILISEARCH_PRODUCTS_EXPORT.json`
8. Click **Upload**

#### Method B: Via API Command

```bash
# From repository root
curl -X POST 'http://127.0.0.1:7700/indexes/products/documents' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer my-local-dev-key-12345' \
  -d @docs/MEILISEARCH_PRODUCTS_EXPORT.json
```

#### Method C: Via Node.js Script

```bash
node -e "
import('./node_modules/meilisearch/index.js').then(async m => {
  const { MeiliSearch } = m;
  const client = new MeiliSearch({ host: 'http://127.0.0.1:7700', apiKey: 'my-local-dev-key-12345' });
  const docs = require('./docs/MEILISEARCH_PRODUCTS_EXPORT.json');
  const task = await client.index('products').addDocuments(docs);
  console.log('✅ Upload task:', task.taskUid);
});
"
```

### Step 5: Verify Local Setup

```bash
# Terminal 1: Check Meilisearch health
curl http://127.0.0.1:7700/health

# Terminal 2: API is already running on port 4000
# Test search with products
curl "http://localhost:4000/api/products?q=shirt&topCategory=Men"

# Should return: { "data": [...matched products...] }
```

### Step 6: Start Full Application

```bash
# Terminal 1: Already running - API (port 4000)
# Terminal 2: Start web app
npm run dev -w @broady/web

# Open http://localhost:3000/catalog
# Try searching for products
```

---

## 🔷 ENVIRONMENT 2: PRODUCTION (CLOUD)

### Step 1: Sign Up for Meilisearch Cloud

1. Visit https://cloud.meilisearch.com
2. Click **Sign up** 
3. Create account with email/password or GitHub
4. Verify email

### Step 2: Create a Cloud Project

1. Click **Create a new project**
2. Choose:
   - **Name**: `broady-production` (or similar)
   - **Region**: Select closest to your users (e.g., `us-east-1` for North America)
   - **Plan**: Free tier for testing, paid for production
3. Click **Create**

**Save these credentials from the dashboard:**
- **Database URL**: `https://ms-xxxxxxxxxxxxx.meilisearch.io`
- **Master Key**: Shown on Dashboard → Settings

### Step 3: Create API Keys in Cloud

1. In Cloud Dashboard → **Settings** → **API Keys**
2. You'll see these auto-generated keys:
   - **Master Key** (all permissions - never share)
   - **Default Search API Key** (read-only, safe for frontend)
   - **Default Admin API Key** (create/delete indexes)

3. **Optional**: Create custom keys for specific purposes
   - Click **Create API Key**
   - Name: `search-only`, Permissions: Search
   - Name: `admin-only`, Permissions: Documents add/delete

**Save these keys:**
```env
MEILISEARCH_DATABASE_URL=https://ms-xxxxxxxxxxxxx.meilisearch.io
MEILISEARCH_ADMIN_API_KEY=xxxxxxxxxxxx  # For indexing/management
MEILISEARCH_SEARCH_API_KEY=xxxxxxxxxxxx  # For frontend search (safer)
MEILISEARCH_CHAT_API_KEY=xxxxxxxxxxxx    # For AI features
```

### Step 4: Configure .env for Production

**File**: `d:\WEB DEVELOPMENT\broady\.env` (or `.env.production`)

```env
# --- Meilisearch Cloud - PRODUCTION ---
# Local URL not used - only Cloud database URL
MEILISEARCH_DATABASE_URL=https://ms-xxxxxxxxxxxxx.meilisearch.io
MEILI_MASTER_KEY=
MEILISEARCH_URL=

# Production Cloud API Keys
MEILISEARCH_ADMIN_API_KEY=your-admin-key-from-dashboard
MEILISEARCH_SEARCH_API_KEY=your-search-key-from-dashboard
MEILISEARCH_CHAT_API_KEY=your-chat-key-from-dashboard
MEILISEARCH_ENABLE_PRODUCT_SEARCH=true
```

**⚠️ Security Note**: Never commit `.env` to git. Only `.env.example` should be in repository.

### Step 5: Upload Products to Cloud Instance

#### Method A: Via Cloud Dashboard (Simplest)

1. Log in to https://cloud.meilisearch.com
2. Click your project name
3. Go to **Indexes** tab
4. Click **Create index**
5. Enter:
   - **Index UID**: `products`
   - **Primary Key**: `id`
6. Click **Create**
7. Once created, click the **products** index
8. Click **Upload Documents** button
9. Select `docs/MEILISEARCH_PRODUCTS_EXPORT.json`
10. Click **Upload**

#### Method B: Via API (Production URL)

```bash
curl -X POST 'https://ms-xxxxxxxxxxxxx.meilisearch.io/indexes/products/documents' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-admin-api-key' \
  -d @docs/MEILISEARCH_PRODUCTS_EXPORT.json
```

### Step 6: Update Index Settings (Optional but Recommended)

The index needs these settings to work optimally:

```json
{
  "searchableAttributes": [
    "name",
    "description",
    "searchDocument",
    "brandName",
    "slug",
    "brandSlug",
    "topCategory",
    "subCategory"
  ],
  "filterableAttributes": [
    "brandId",
    "brandSlug",
    "topCategory",
    "subCategory",
    "pricePkr",
    "isActive",
    "approvalStatus",
    "stock",
    "sizes"
  ],
  "sortableAttributes": [
    "pricePkr",
    "createdAt",
    "updatedAt",
    "averageRating",
    "totalReviews"
  ]
}
```

Apply via API:

```bash
curl -X PATCH 'https://ms-xxxxxxxxxxxxx.meilisearch.io/indexes/products/settings' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-admin-api-key' \
  -d '{
    "searchableAttributes": ["name", "description", "searchDocument", "brandName", "slug", "brandSlug", "topCategory", "subCategory"],
    "filterableAttributes": ["brandId", "brandSlug", "topCategory", "subCategory", "pricePkr", "isActive", "approvalStatus", "stock", "sizes"],
    "sortableAttributes": ["pricePkr", "createdAt", "updatedAt", "averageRating", "totalReviews"]
  }'
```

### Step 7: Test Production Setup

```bash
# Make sure API is running with production .env
npm run dev -w @broady/api

# Test search against production Meilisearch
curl "http://localhost:4000/api/products?q=shirt&topCategory=Men"

# Should return products from Cloud instance
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Local Development Setup

- [ ] Meilisearch binary installed (choco/winget or manual download)
- [ ] Meilisearch running on http://127.0.0.1:7700
- [ ] Master key configured in `.env` (MEILI_MASTER_KEY)
- [ ] Products uploaded to local `products` index
- [ ] `.env` has MEILISEARCH_URL=http://127.0.0.1:7700
- [ ] API running: `npm run dev -w @broady/api`
- [ ] Web running: `npm run dev -w @broady/web`
- [ ] Search test passes: http://localhost:3000/catalog → search for "shirt"
- [ ] Database health: `curl http://localhost:4000/health` returns healthy
- [ ] Meilisearch health: `curl http://127.0.0.1:7700/health`

### Production Cloud Setup

- [ ] Meilisearch Cloud account created
- [ ] Cloud project created (region selected)
- [ ] API keys copied from Cloud Dashboard
- [ ] `.env` updated with Cloud URL and keys
- [ ] `.env` NOT committed to git (verify .gitignore)
- [ ] Products uploaded to Cloud `products` index
- [ ] Index settings applied (searchable/filterable/sortable)
- [ ] API deployed with production `.env`
- [ ] Search test passes with Cloud instance
- [ ] Monitoring enabled (Cloud Dashboard → Monitoring)
- [ ] Backup plan documented

---

## 🔄 Real-Time Sync to Meilisearch

When products are created/updated/deleted via the API, Meilisearch is automatically synced:

### Product Creation

```bash
curl -X POST 'http://localhost:4000/api/products' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-jwt-token' \
  -d '{
    "brandId": "brand-123",
    "name": "New T-Shirt",
    "slug": "new-t-shirt",
    "description": "Premium cotton",
    "pricePkr": 1999,
    "topCategory": "Men",
    "subCategory": "T-Shirts",
    "sizes": ["M", "L", "XL"],
    "stock": 50
  }'

# Automatically synced to Meilisearch index
```

### Product Update

```bash
curl -X PATCH 'http://localhost:4000/api/products/product-123' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-jwt-token' \
  -d '{ "pricePkr": 1799 }'

# Meilisearch document updated automatically
```

### Product Deletion

```bash
curl -X DELETE 'http://localhost:4000/api/products/product-123' \
  -H 'Authorization: Bearer your-jwt-token'

# Removed from Meilisearch index automatically
```

This is handled by notification events:
- File: `apps/api/src/modules/products/products.module.ts`
- Events emit to notification queue
- Meilisearch sync happens in background

---

## 📊 Monitoring & Troubleshooting

### Monitor Local Instance

```bash
# Dashboard: http://127.0.0.1:7700

# Check index stats
curl 'http://127.0.0.1:7700/indexes/products/stats' \
  -H 'Authorization: Bearer my-master-key'

# Response:
# {
#   "numberOfDocuments": 52,
#   "isIndexing": false,
#   "fieldDistribution": {
#     "id": 52,
#     "name": 52,
#     "pricePkr": 52,
#     ...
#   }
# }
```

### Monitor Cloud Instance

1. Log in to https://cloud.meilisearch.com
2. Select your project
3. View:
   - **Dashboard**: Statistics and metrics
   - **Indexes**: Document count, last updated
   - **Monitoring**: Response times, error rates
   - **Settings**: API keys, webhooks

### Troubleshooting

#### Products not appearing in search

```bash
# 1. Check index exists
curl 'http://127.0.0.1:7700/indexes/products' \
  -H 'Authorization: Bearer your-key'

# 2. Check documents uploaded
curl 'http://127.0.0.1:7700/indexes/products/stats' \
  -H 'Authorization: Bearer your-key'

# 3. Verify document format
head -5 docs/MEILISEARCH_PRODUCTS_EXPORT.json
```

#### Search returns 0 results

```bash
# 1. Check if query matches searchable fields
curl 'http://127.0.0.1:7700/indexes/products/search' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-key' \
  -d '{"q":"shirt"}'

# 2. Check if filters are too restrictive
curl 'http://127.0.0.1:7700/indexes/products/search' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-key' \
  -d '{"q":"shirt","filter":["topCategory=Men"]}'
```

#### API not connecting to Meilisearch

```bash
# 1. Check .env configuration
grep MEILISEARCH .env

# 2. Check if service is running
curl http://127.0.0.1:7700/health  # Local
curl https://ms-xxx.meilisearch.io/health  # Cloud

# 3. Check API logs
npm run dev -w @broady/api  # Watch for connection errors
```

---

## 📱 Testing Search Features

### Basic Search

```bash
curl "http://localhost:4000/api/products?q=shirt"
```

### With Filters

```bash
# Search with category filter
curl "http://localhost:4000/api/products?q=shirt&topCategory=Men"

# Search with price range
curl "http://localhost:4000/api/products?q=shirt&minPrice=1000&maxPrice=5000"

# Search by brand
curl "http://localhost:4000/api/products?q=shirt&brand=cougar"
```

### Suggestions

```bash
curl "http://localhost:4000/api/products/suggest?q=shirt"
```

---

## 🔐 Security Best Practices

1. **Never share Master Key** - Only for local development
2. **Use Search API Key in frontend** - Read-only key for UI
3. **Use Admin API Key on backend** - For indexing/management
4. **Rotate keys regularly** - Change keys every 90 days
5. **Enable 2FA** - On Meilisearch Cloud account
6. **Monitor API usage** - Check Cloud Dashboard for unusual activity
7. **Set rate limits** - In Cloud Settings → API Keys

---

## 📞 Support Resources

- **Meilisearch Docs**: https://docs.meilisearch.com
- **Cloud Dashboard**: https://cloud.meilisearch.com
- **Broady API Docs**: See [Broady API Reference](./BROADY_API_REFERENCE.md)
- **Troubleshooting**: See section above

---

**Last Updated**: May 4, 2026  
**Meilisearch Version**: v1.0+  
**Broady API Version**: Latest  
**Products in Database**: 52 (ready for upload)
