# Broady Taxonomy System - Quick Start Guide

## 🎯 What Has Been Implemented

### Core System (✅ Complete)
1. **Prisma Schema** - Complete taxonomy enums and Product model updates
2. **Taxonomy Module** - Central constants, enums, mappings, and utilities
3. **Classification Service** - AI-powered product classification with confidence scoring
4. **Normalization Service** - Complete ingestion pipeline (Extract → Classify → Normalize → Validate)
5. **Validation Schemas** - Zod schemas for all taxonomy operations
6. **Migration Script** - Automated script to migrate existing products

## 🚀 Getting Started

### Step 1: Apply Database Schema Changes

```bash
cd apps/api

# Backup your database first!
pg_dump broady > backup.sql

# Apply Prisma migration
npx prisma migrate dev --name add_taxonomy_system

# Generate Prisma client
npx prisma generate
```

### Step 2: Migrate Existing Products

```bash
# Dry run first (no changes to database)
npm run migrate:taxonomy -- --dry-run

# Run actual migration
npm run migrate:taxonomy

# Or with custom batch size
npm run migrate:taxonomy -- --batch-size=50
```

Add this script to `apps/api/package.json`:
```json
{
  "scripts": {
    "migrate:taxonomy": "ts-node src/scripts/migrate-product-taxonomy.ts"
  }
}
```

### Step 3: Using the Classification System

#### Classify a Single Product

```typescript
import { classifyProduct } from './modules/products/classification.service';

const result = await classifyProduct({
  title: 'Premium Knit Shirt',
  description: 'Comfortable cotton knit shirt',
  brandCategory: 'Shirts',
  brandSubcategory: 'Knit',
  gender: 'men',
  tags: ['casual', 'cotton'],
});

console.log(result);
// {
//   gender: 'MEN',
//   productType: 'TOP',
//   department: 'CLOTHING',
//   category: 'SHIRTS',
//   subcategory: 'KNIT_SHIRT',
//   confidence: 0.85,
//   method: 'RULE_BASED'
// }
```

#### Normalize and Ingest Product

```typescript
import { ingestProduct } from './modules/products/normalization.service';

const result = await ingestProduct(
  {
    title: 'Running Sneaker',
    description: 'Lightweight running shoes',
    price: 5000,
    images: ['https://...'],
    sizes: ['8', '9', '10'],
    colors: ['Black', 'White'],
    stock: 50,
  },
  'brandId123',
  'Nike'
);

if (result.success) {
  // Save to database
  await prisma.product.create({
    data: result.product,
  });
} else if (result.needsReview) {
  // Send to admin review queue
  console.log('Needs review:', result.warnings);
}
```

### Step 4: Query Products with New Taxonomy

```typescript
// Find all men's shirts
const shirts = await prisma.product.findMany({
  where: {
    gender: 'MEN',
    department: 'CLOTHING',
    category: 'SHIRTS',
    deletedAt: null,
  },
});

// Find knit shirts specifically
const knitShirts = await prisma.product.findMany({
  where: {
    category: 'SHIRTS',
    subcategory: 'KNIT_SHIRT',
    deletedAt: null,
  },
});

// Find products by availability
const inStock = await prisma.product.findMany({
  where: {
    availabilityStatus: 'IN_STOCK',
    isActive: true,
  },
});
```

## 📚 Key Concepts

### Gender
- **Values**: MEN, WOMEN, BOYS, GIRLS, UNISEX
- **Use**: Primary user segmentation
- **Examples**: 
  - "Outfitters Men" → MEN
  - "Juniors Boys" → BOYS

### ProductType (Internal Only)
- **Values**: TOP, BOTTOM, FOOTWEAR, ACCESSORY
- **Use**: Backend categorization, NOT exposed to users
- **Auto-derived**: From category

### Department
- **Values**: CLOTHING, FOOTWEAR, ACCESSORIES
- **Use**: Top-level customer-facing filter
- **Auto-derived**: From category

### Category
- **Values**: SHIRTS, T_SHIRTS, POLOS, JEANS, SNEAKERS, etc. (40+ options)
- **Use**: Primary product classification
- **Examples**: 
  - "Textured Shirt" → SHIRTS
  - "Running Shoes" → SNEAKERS

### Subcategory
- **Values**: TEXTURED_SHIRT, KNIT_SHIRT, RUNNING_SNEAKER, etc. (100+ options)
- **Use**: Fine-grained classification, drives dynamic filters
- **Optional**: Can be null if no specific subcategory applies

### Brand Taxonomy Preservation
- **Fields**: `brandCategoryRaw`, `brandSubcategoryRaw`
- **Purpose**: Audit trail, preserve original brand structure
- **Never Used For**: Filtering, search, recommendations
- **Display**: Internal only, not shown to users

## 🔍 Classification Confidence

```typescript
if (classification.confidence >= 0.8) {
  // High confidence - auto-approve
  status = 'APPROVED';
} else if (classification.confidence >= 0.7) {
  // Medium confidence - review recommended
  status = 'NEEDS_REVIEW';
} else {
  // Low confidence - manual review required
  status = 'PENDING_CLASSIFICATION';
}
```

## 🛠️ Utility Functions

### Gender Normalization
```typescript
import { normalizeGender } from './modules/products/taxonomy';

normalizeGender('men'); // Gender.MEN
normalizeGender('ladies'); // Gender.WOMEN
normalizeGender('boys'); // Gender.BOYS
```

### Derive Department and ProductType
```typescript
import { 
  getDepartmentFromCategory, 
  getProductTypeFromCategory 
} from './modules/products/taxonomy';

getDepartmentFromCategory(Category.SHIRTS); // Department.CLOTHING
getProductTypeFromCategory(Category.SNEAKERS); // ProductType.FOOTWEAR
```

### Get Subcategories for Category
```typescript
import { getSubcategoriesForCategory } from './modules/products/taxonomy';

const subcats = getSubcategoriesForCategory(Category.SHIRTS);
// [Subcategory.TEXTURED_SHIRT, Subcategory.KNIT_SHIRT, ...]
```

### Format for Display
```typescript
import { formatEnumForDisplay } from './modules/products/taxonomy';

formatEnumForDisplay('KNIT_SHIRT'); // "Knit Shirt"
formatEnumForDisplay('T_SHIRTS'); // "T Shirts"
```

## 🎨 Frontend Integration Example

```typescript
// Product card display
function ProductCard({ product }: { product: Product }) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>Category: {formatEnumForDisplay(product.category)}</p>
      {product.subcategory && (
        <p>Type: {formatEnumForDisplay(product.subcategory)}</p>
      )}
      <p>Colors: {product.colors.join(', ')}</p>
      <p>Sizes: {product.sizes.join(', ')}</p>
      {product.material && <p>Material: {product.material}</p>}
      <span className={product.availabilityStatus === 'IN_STOCK' ? 'green' : 'red'}>
        {formatEnumForDisplay(product.availabilityStatus)}
      </span>
    </div>
  );
}
```

## 🚧 What Needs to Be Done Next

### Critical (Blocking)
1. **Fix database migration** - Resolve Prisma shadow database issue
2. **Integrate normalization in product API** - Update create/import endpoints
3. **Build dynamic filtering backend** - `/api/products/filters/available` endpoint

### High Priority
4. **Update catalog frontend** - New filter panel with dynamic updates
5. **Admin classification review UI** - For low-confidence products
6. **Update search** - Use normalized taxonomy

### Medium Priority
7. **Gender landing pages** - /men, /women, /juniors
8. **Update analytics** - Track normalized categories
9. **Update admin product forms** - Use taxonomy dropdowns

### Low Priority
10. **Recommendations** - Use normalized taxonomy
11. **Documentation** - API docs, user guide

## 📖 API Examples

### Create Product (New Format)

```typescript
POST /api/products

{
  "brandId": "clx123...",
  "name": "Premium Knit Shirt",
  "description": "Comfortable cotton knit shirt perfect for casual wear",
  "gender": "MEN",
  "productType": "TOP",  // auto-derived, but can be explicit
  "department": "CLOTHING",  // auto-derived
  "category": "SHIRTS",
  "subcategory": "KNIT_SHIRT",
  "colors": ["Navy", "Gray", "Black"],
  "sizes": ["S", "M", "L", "XL"],
  "material": "Cotton",
  "fit": "Regular Fit",
  "tags": ["casual", "comfortable", "cotton"],
  "availabilityStatus": "IN_STOCK",
  "pricePkr": 3500,
  "actualPrice": 3500,
  "imageUrl": "https://...",
  "stock": 50,
  "isActive": true
}
```

### Filter Products (New Format)

```typescript
GET /api/products?gender=MEN&category=SHIRTS&subcategory=KNIT_SHIRT&minPrice=2000&maxPrice=5000

Response:
{
  "products": [...],
  "total": 45,
  "page": 1,
  "limit": 20,
  "filters": {
    "applied": {
      "gender": ["MEN"],
      "category": ["SHIRTS"],
      "subcategory": ["KNIT_SHIRT"]
    },
    "available": {
      "colors": ["Navy", "Gray", "Black", "White"],
      "sizes": ["S", "M", "L", "XL"],
      "subcategories": ["KNIT_SHIRT", "TEXTURED_SHIRT", "FORMAL_SHIRT"]
    }
  }
}
```

### Search Products

```typescript
GET /api/products/search?q=knit+shirt&gender=MEN

// Returns products ranked by:
// 1. Exact subcategory match (KNIT_SHIRT)
// 2. Category match (SHIRTS)
// 3. searchKeywords match
// 4. Title/description match
```

## 🐛 Troubleshooting

### "Gender is not a valid enum"
- Run `npx prisma generate` to regenerate Prisma client
- Ensure migration was applied

### "Cannot find module 'taxonomy'"
- Check import path: `import { Gender } from './modules/products/taxonomy'`
- Restart TypeScript server

### Migration fails
- Check database connectivity
- Ensure no pending migrations
- Try `npx prisma migrate reset` (WARNING: drops data)

### Low classification confidence
- Add more brand-specific mappings in `mapBrandCategory()`
- Improve category keywords in `CATEGORY_KEYWORDS`
- Train AI classification model (future enhancement)

## 📞 Support

See `TAXONOMY_IMPLEMENTATION_STATUS.md` for detailed implementation progress and remaining tasks.

For issues, check:
1. Prisma schema matches taxonomy enums
2. Classification service is imported correctly
3. Database migration was applied
4. Prisma client was regenerated
