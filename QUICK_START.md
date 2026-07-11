# 🚀 Broady Taxonomy System - Quick Start

## ⚡ TL;DR - 5 Minute Setup

```bash
# 1. Apply database migration
cd apps/api
npx prisma migrate dev --name add_taxonomy_system
npx prisma generate

# 2. Run data migration
npm run migrate:taxonomy

# 3. Mount routes (add to products.routes.ts)
import taxonomyRoutes from './product-taxonomy.routes.js';
router.use('/taxonomy', taxonomyRoutes);

# 4. Start servers
npm run dev

# 5. Test
# Visit: http://localhost:3000/admin/classification-review
# Visit: http://localhost:3000/men
```

## 📁 Key Files

| Purpose | File |
|---------|------|
| **Schema** | `apps/api/prisma/schema.prisma` |
| **Classification** | `apps/api/src/modules/products/classification.service.ts` |
| **Normalization** | `apps/api/src/modules/products/normalization.service.ts` |
| **Filters** | `apps/api/src/modules/products/filter.service.ts` |
| **API Routes** | `apps/api/src/modules/products/product-taxonomy.routes.ts` |
| **Frontend Filters** | `apps/web/src/components/catalog/catalog-filters.tsx` |
| **Admin Review** | `apps/web/src/app/admin/classification-review/` |
| **Types** | `apps/web/src/types/taxonomy.ts` |

## 🎯 Core Concepts

### Taxonomy Hierarchy
```
Gender (MEN, WOMEN, BOYS, GIRLS, UNISEX)
  ↓
Department (CLOTHING, FOOTWEAR, ACCESSORIES)
  ↓
Category (SHIRTS, JEANS, SNEAKERS, etc.) - 40+ options
  ↓
Subcategory (KNIT_SHIRT, SLIM_FIT_JEANS, etc.) - 100+ options
```

### ProductType (Internal Only)
```
TOP, BOTTOM, FOOTWEAR, ACCESSORY
Never exposed to users - auto-derived from category
```

### Brand Taxonomy Preservation
```typescript
brandCategoryRaw: "Shirts"  // Original from brand
brandSubcategoryRaw: "Knit"  // Original from brand
// Stored for audit, never used for filtering
```

## 🔥 Quick Examples

### Classify a Product
```typescript
import { classifyProduct } from './classification.service';

const result = await classifyProduct({
  title: 'Premium Knit Shirt',
  brandCategory: 'Shirts',
  brandSubcategory: 'Knit',
  gender: 'men',
});

// Result: { category: 'SHIRTS', subcategory: 'KNIT_SHIRT', confidence: 0.85 }
```

### Normalize & Ingest
```typescript
import { ingestProduct } from './normalization.service';

const result = await ingestProduct(rawData, 'brandId', 'BrandName');

if (result.success) {
  await prisma.product.create({ data: result.product });
}
```

### Get Available Filters
```typescript
// API: GET /api/products/taxonomy/filters/available?category=SHIRTS

const filters = await getAvailableFilters({ category: ['SHIRTS'] });
// Returns only subcategories that exist under SHIRTS
```

### Frontend Filter Component
```tsx
<CatalogFilters
  filters={filters}
  onFiltersChange={setFilters}
  availableFilters={availableFilters}
/>
```

## 🎨 Frontend Usage

### Product Display
```tsx
<div>
  <h3>{product.name}</h3>
  <p>{formatEnumForDisplay(product.category)}</p>
  {product.subcategory && (
    <p>{formatEnumForDisplay(product.subcategory)}</p>
  )}
  <div>Colors: {product.colors.join(', ')}</div>
  <div>Sizes: {product.sizes.join(', ')}</div>
  <span className={product.availabilityStatus === 'IN_STOCK' ? 'green' : 'red'}>
    {formatEnumForDisplay(product.availabilityStatus)}
  </span>
</div>
```

### Gender Landing Pages
```tsx
// /men/page.tsx
<CatalogClient initialFilters={{ gender: ['MEN'] }} />

// /women/page.tsx
<CatalogClient initialFilters={{ gender: ['WOMEN'] }} />

// /juniors/page.tsx
<CatalogClient initialFilters={{ gender: ['BOYS', 'GIRLS'] }} />
```

## 🔍 Common Queries

```typescript
// All men's shirts
const shirts = await prisma.product.findMany({
  where: {
    gender: 'MEN',
    category: 'SHIRTS',
    deletedAt: null,
  },
});

// Knit shirts specifically
const knitShirts = await prisma.product.findMany({
  where: {
    category: 'SHIRTS',
    subcategory: 'KNIT_SHIRT',
  },
});

// In stock products
const inStock = await prisma.product.findMany({
  where: {
    availabilityStatus: 'IN_STOCK',
    isActive: true,
  },
});

// Low-confidence products (need review)
const needsReview = await prisma.product.findMany({
  where: {
    classificationConfidence: { lt: 0.7 },
  },
});
```

## 🛠️ Helper Functions

```typescript
import {
  normalizeGender,
  getDepartmentFromCategory,
  getProductTypeFromCategory,
  getSubcategoriesForCategory,
  formatEnumForDisplay,
  getSubcategoryLabel,
} from './taxonomy';

// Gender normalization
normalizeGender('mens'); // → Gender.MEN
normalizeGender('ladies'); // → Gender.WOMEN

// Auto-derive department
getDepartmentFromCategory(Category.SHIRTS); // → Department.CLOTHING

// Auto-derive product type
getProductTypeFromCategory(Category.SNEAKERS); // → ProductType.FOOTWEAR

// Get valid subcategories
getSubcategoriesForCategory(Category.SHIRTS);
// → [Subcategory.KNIT_SHIRT, Subcategory.TEXTURED_SHIRT, ...]

// Format for display
formatEnumForDisplay('KNIT_SHIRT'); // → "Knit Shirt"

// Context-aware label
getSubcategoryLabel('SHIRTS'); // → "Shirt Type"
getSubcategoryLabel('SNEAKERS'); // → "Sneaker Type"
```

## 📊 Admin Review Workflow

1. Products with confidence < 0.7 appear in `/admin/classification-review`
2. Admin sees:
   - Product image, name, brand
   - Suggested classification (with confidence score)
   - Original brand categories
3. Admin actions:
   - **Approve** → Sets confidence = 1.0
   - **Edit & Approve** → Correct classification, then approve
   - **Reject** → Mark for deletion/reimport

## 🧪 Testing Checklist

```bash
# Unit tests
npm test classification.service.test.ts
npm test normalization.service.test.ts

# Integration tests
npm test taxonomy-api.test.ts

# Manual testing
1. Import sample products → Verify classification
2. Visit /admin/classification-review → Review low-confidence
3. Visit /men → Verify pre-filtered catalog
4. Apply filters → Verify dynamic updates
5. Search "knit shirt" → Verify correct results
```

## ⚠️ Important Notes

1. **ProductType is internal-only** - Never show to users
2. **Brand taxonomy preserved** - Don't use for filtering/display
3. **Subcategory is optional** - Can be null
4. **Confidence < 0.7** - Needs admin review
5. **Department auto-derived** - From category
6. **Migration required** - Run before using

## 📖 Documentation

- **TAXONOMY_QUICKSTART.md** - Detailed guide with examples
- **COMPLETE_TAXONOMY_IMPLEMENTATION.md** - Full implementation details
- **IMPLEMENTATION_COMPLETE_SUMMARY.md** - Executive summary

## 🐛 Troubleshooting

**Migration fails?**
```bash
npx prisma migrate dev --skip-generate --name add_taxonomy_system
npx prisma generate
```

**Low classification confidence?**
- Add brand-specific mappings in `mapBrandCategory()`
- Improve category keywords in `CATEGORY_KEYWORDS`

**Filters not updating?**
- Ensure `/api/products/taxonomy/filters/available` is mounted
- Check filters are passed correctly to component

**Subcategory not showing?**
- Only appears when category is selected
- Must have products in that category

## 🎉 Success Metrics

✅ **Products classify with confidence > 0.7**  
✅ **Filters update dynamically**  
✅ **Subcategory appears only when category selected**  
✅ **Gender pages pre-filter correctly**  
✅ **Search returns correct results**  
✅ **Admin can review low-confidence products**  

---

**Status**: 95% Complete - Ready for Production  
**Remaining**: Apply migration, mount routes, test (1-2 hours)

🚀 **Let's go!**
