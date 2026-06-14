# Product Scraping Agent Rules for Broady Ingestion

**Version:** 2.0  
**Changes from v1:** Added page context extraction (URL segments + breadcrumbs), updated output shape with `division`, `sub_type`, `sub_type_confidence`, `mapping_status`, `page_context` fields, corrected `product_type` to `division`, corrected `category` to use Broady canonical values (not brand values), added taxonomy resolution rules, updated validation checklist, updated final payload example.

---

These rules are for scraper agents that extract product data from any fashion brand website and prepare it for Broady's product ingestion pipeline.

The scraper must not copy a brand's structure directly into Broady. Every scraped product must be normalized into Broady-compatible fields so the ingestion pipeline can validate, store, and send products for admin approval.

---

## Core Principle

Every brand may organize product data differently, but the scraper output must always follow one universal Broady product contract.

Use this flow:

```
brand product page
→ extract page context (URL segments + breadcrumbs) FIRST
→ extract raw product data
→ classify brand-specific sections
→ normalize into Broady fields using brand adapter
→ attach page_context object
→ keep raw data for audit and debugging
→ send normalized product payload to ingestion
```

Page context must be extracted before any product-level scraping begins. It is the primary source for taxonomy classification.

Do not dump brand-specific sections into `description`.

Do not place Fabric & Care, Returns, Size Guide, Disclaimer, Fit, or Model Details into generic Product Details.

---

## Step 0 — Extract Page Context First

Before scraping any individual product, the agent must extract and record the page context from the scraping URL and the breadcrumb on the product page.

### URL Segment Extraction

```
Input URL: outfitters.com/men/shirts/embedded
Extract:
  segments[0] = "men"        → gender_raw
  segments[1] = "shirts"     → category_raw
  segments[2] = "embedded"   → sub_type_raw
```

```
Input URL: cougar.com/women/footwear/sneakers
Extract:
  gender_raw  = "women"
  category_raw = "footwear"
  sub_type_raw = "sneakers"
```

```
Input URL: breakout.com/accessories/footwear/trainers
Extract:
  gender_raw  = null (not in URL — resolve from page)
  category_raw = "footwear"      (ignore parent "accessories" — use footwear)
  sub_type_raw = "trainers"
```

### Breadcrumb Extraction

On every product page, scrape the breadcrumb trail.

Look for:

```
nav.breadcrumb
ol.breadcrumbs
.breadcrumb-nav
[aria-label="breadcrumb"]
[itemtype="https://schema.org/BreadcrumbList"]
```

Output:

```json
{
  "breadcrumb_raw": ["Men", "Shirts", "Embedded Shirts"]
}
```

Breadcrumb is the fallback confirmation source when URL segments are ambiguous or not descriptive.

### Page Context Object

Attach this object to every product payload. The ingestion pipeline uses it to apply the brand adapter and resolve taxonomy.

```json
{
  "page_context": {
    "scrape_url": "https://outfitters.com/men/shirts/embedded",
    "url_segments": ["men", "shirts", "embedded"],
    "breadcrumb_raw": ["Men", "Shirts", "Embedded Shirts"],
    "gender_raw": "Men",
    "category_raw": "Shirts",
    "sub_type_raw": "Embedded Shirts"
  }
}
```

The normalized taxonomy fields (`division`, `category`, `sub_type`, `mapping_status`) are resolved by the ingestion pipeline using the brand adapter. The scraper does not resolve them — it only provides the raw context.

---

## Required Output Shape

Each scraped product outputs one object:

```json
{
  "external_product_id": "brand-product-id-or-sku",
  "external_source": "scraper",
  "brand_name": "Brand Name",
  "title": "Clean Product Title",
  "slug": "brand-or-product-slug",
  "short_description": "Optional short summary",
  "description": "Only the real product description, not policy or detail sections",
  "gender": "men",
  "division": "top",
  "category": "shirt",
  "sub_type": "embedded",
  "sub_type_confidence": "explicit",
  "fit": "Regular Fit",
  "season": "SS-26",
  "collection": "New Arrivals",
  "product_url": "https://brand.com/products/example",
  "actual_price": 4990,
  "sale_price": 3990,
  "currency": "PKR",
  "label": "New",
  "colors": ["Black", "White"],
  "sizes": ["S", "M", "L", "XL"],
  "variants": [],
  "images": [],
  "size_guide": {},
  "shipping_delivery": {},
  "deliveries_returns": {},
  "fabric_care": {},
  "detail": {},
  "seo": {},
  "additional_info": [],
  "page_context": {},
  "raw": {}
}
```

### Taxonomy Field Rules

| Field | Type | Rule |
|---|---|---|
| `gender` | string | Must be one of: men, women, boys, girls. Resolved from page_context via brand adapter. Null if unresolvable. |
| `division` | string | Must be one of: top, bottom, footwear, accessory. Resolved from page_context via brand adapter. Null if unresolvable. |
| `category` | string | Must be a Broady canonical category value (shirt, polo, sneaker, etc.). Resolved via brand adapter. Null if unresolvable. |
| `sub_type` | string or null | Broady canonical sub-type value or null. Never invent values. |
| `sub_type_confidence` | string | explicit (from URL/breadcrumb/adapter label), inferred (from title keyword), or null. |

Do not use brand-specific taxonomy values in these fields. The adapter maps brand values to Broady values. If the adapter cannot resolve a field, leave it null and the ingestion pipeline will set `mapping_status: unresolved`.

### Removed Fields from v1

The following fields from v1 are replaced:

```
subcategory        → removed. Use category (Broady canonical value).
product_type       → renamed to division. Must be: top | bottom | footwear | accessory.
```

If you see `product_type` in legacy scraper output, treat it as `division` and normalize the value.

---

## Taxonomy Resolution by the Scraper

The scraper agent resolves taxonomy in this priority order:

```
Priority 1: URL path segments  → most reliable
Priority 2: Page breadcrumb    → second source
Priority 3: Brand label match  → from adapter category_map
Priority 4: Title keyword      → from adapter title_keyword_sub_type_map (sub_type only)
Priority 5: Leave null         → flag for admin review
```

When a value is resolved from title keywords, set `sub_type_confidence: inferred`. For all other sources, set `sub_type_confidence: explicit`.

---

## Product Identity Rules

| Broady field | Scraper source examples | Rule |
|---|---|---|
| `external_product_id` | product id, handle, SKU, data-product-id | Required if available. Stable across re-scrapes. |
| `title` | h1, product title, meta title | Clean brand prefix and extra whitespace. |
| `slug` | URL handle, product slug | Stable, lowercase. |
| `product_url` | current page URL | Always include canonical product page URL. |
| `brand_name` | site config, page brand, scraper job brand | Required. |

Never generate a random external ID when the brand has a stable ID, SKU, handle, or URL slug.

---

## Description Rules

`description` must contain only the actual product description.

Remove these sections from description and map them to dedicated fields:

```
FIT
FABRIC
FABRIC & CARE
COMPOSITION
CARE INSTRUCTIONS
SIZE GUIDE
SIZE CHART
SHIPPING
DELIVERY
RETURNS
RETURN & EXCHANGE
EXCHANGE POLICY
DISCLAIMER
MODEL DETAILS
MATERIAL
ORIGIN
PACKAGE INCLUDES
```

HTML-like content must be converted to clean readable text.

Example input:

```html
<p><strong>FIT:</strong> Regular</p>
<p><strong>FABRIC & CARE:</strong> Cotton. Hand wash.</p>
```

Correct output:

```json
{
  "description": "",
  "fit": "Regular",
  "fabric_care": {
    "fabricType": "Cotton",
    "careInstructions": ["Hand wash"]
  },
  "detail": {
    "fitDetails": "Regular",
    "fabricComposition": "Cotton",
    "careGuide": "Hand wash"
  }
}
```

---

## Dedicated Section Mapping

Classify headings and labels using normalized lowercase text.

### Size Guide

Map these labels into `size_guide`:

```
size guide / size chart / measurements / measurement guide / size & fit
```

Output:

```json
{
  "size_guide": {
    "imageUrl": "https://brand.com/size-chart.jpg",
    "details": ["Model wears size M", "Size up for relaxed fit"],
    "entries": [
      { "size": "S", "cm": "86-90", "inches": "34-35" }
    ]
  },
  "detail": {
    "sizeGuideText": "Size up for relaxed fit",
    "sizeGuideImageUrl": "https://brand.com/size-chart.jpg"
  }
}
```

### Shipping and Delivery

Map these labels into `shipping_delivery`:

```
shipping / delivery / shipping & delivery / estimated delivery / dispatch time
```

Output:

```json
{
  "shipping_delivery": {
    "estimatedDeliveryTime": "Delivered in 3-5 working days",
    "regions": ["Pakistan"],
    "charges": "Free above PKR 4,999"
  }
}
```

### Return and Exchange

Map these labels into `deliveries_returns`:

```
returns / return policy / exchange / return & exchange / refund policy / refund conditions
```

Output:

```json
{
  "deliveries_returns": {
    "returnPolicy": "Exchange within 7 days for unused items.",
    "refundConditions": "Refund after quality check."
  },
  "detail": {
    "returnExchangePolicy": "Exchange within 7 days for unused items."
  }
}
```

Do not put return or exchange text into delivery time.

### Fabric and Care

Map these labels into `fabric_care`:

```
fabric / fabric & care / composition / material composition / care / care guide / wash care / care instructions
```

Output:

```json
{
  "fabric_care": {
    "fabricType": "100% Cotton",
    "careInstructions": ["Machine wash cold", "Do not bleach"]
  },
  "detail": {
    "fabricComposition": "100% Cotton",
    "careGuide": "Machine wash cold\nDo not bleach"
  }
}
```

### Fit

Map these labels into `fit` and `detail.fitDetails`:

```
fit / fitting / fit type / fit details / size & fit
```

Examples:

```
Regular Fit / Slim Fit / Relaxed Fit / Oversized / Boxy Fit
```

### Model Details

Map into `detail.modelDetails`:

```
model details / model info / model is wearing / model height / size worn
```

Do not mix model details with `fit` unless brand gives only a combined "Size & Fit" section. If combined, split when possible.

### Disclaimer

Map into `detail.disclaimer`:

```
disclaimer / note / important note / color may vary / sale item policy
```

Keep disclaimer separate. Do not put it in `description` or `additional_info`.

### Material, Origin, Package Includes

Map into `detail`:

```json
{
  "detail": {
    "materialDetails": "Medium-weight woven fabric",
    "origin": "Made in Pakistan",
    "packageIncludes": "1 shirt"
  }
}
```

---

## Additional Details Rule

For customer-facing Broady product pages, `additional_info` should only contain:

```
Estimated Delivery Time: Delivered in 3-5 working days
```

Do not add random source fields to `additional_info`.

```json
{
  "additional_info": [
    {
      "label": "Estimated Delivery Time",
      "value": "Delivered in 3-5 working days"
    }
  ]
}
```

All other source-specific or debugging fields belong in `raw`, not customer-facing details.

---

## Pricing Rules

| Field | Rule |
|---|---|
| `actual_price` | Original/list price. Required. |
| `sale_price` | Only if lower than `actual_price`. |
| `currency` | Use `PKR` unless source clearly says otherwise. |
| `discount_percentage` | Optional. Broady calculates it. |

```
If sale_price equals actual_price, omit sale_price.
If discount is 0%, omit discount_percentage.
Do not create sale badge for 0% discount.
```

---

## Variant Rules

Each color-size combination becomes a variant.

Output:

```json
{
  "variants": [
    {
      "externalVariantId": "12345",
      "sku": "BRAND-SHIRT-BLK-M",
      "barcode": "optional",
      "color": "Black",
      "colorHex": "#000000",
      "size": "M",
      "fit": "Regular",
      "pricePkr": 4990,
      "salePricePkr": 3990,
      "compareAtPricePkr": 4990,
      "stockStatus": "in_stock",
      "quantity": 12,
      "isActive": true
    }
  ]
}
```

Availability mapping:

```
in stock, available, add to cart      → in_stock
only few left, low stock              → low_stock
sold out, unavailable, disabled size  → out_of_stock
```

If a size exists but is unavailable, still include it:

```json
{
  "size": "M",
  "stockStatus": "out_of_stock",
  "quantity": 0,
  "isActive": false
}
```

This lets Broady show the size as unselectable rather than hiding it.

---

## Color Rules

Extract all colors, not only the selected color.

Look for:

```
color selector buttons
variant JSON in page source
swatch images
data-color attributes
URL variant handles
product option arrays
```

Normalize names:

```
Blk → Black
Wht → White
Nvy → Navy
Off White → Off White
```

If hex color or swatch image exists, capture it.

---

## Size Rules

Extract all sizes, including unavailable ones.

Support:

```
XS, S, M, L, XL, XXL
28, 30, 32, 34, 36
37, 38, 39, 40, 41, 42
One Size
4Y, 6Y, 8Y, 10Y
```

Do not remove sold-out sizes. Mark them `out_of_stock` in variants.

---

## Image Rules

Extract all product images.

```
main product image
gallery images
variant/color images
swatch images
size guide image
```

Output:

```json
{
  "images": [
    {
      "sourceUrl": "https://brand.com/image-1.jpg",
      "url": "https://brand.com/image-1.jpg",
      "altText": "Black regular fit shirt front view",
      "imageType": "main",
      "isPrimary": true,
      "sortOrder": 0
    },
    {
      "sourceUrl": "https://brand.com/image-2.jpg",
      "url": "https://brand.com/image-2.jpg",
      "altText": "Black regular fit shirt back view",
      "imageType": "gallery",
      "isPrimary": false,
      "sortOrder": 1
    }
  ]
}
```

Rules:

```
Preserve image order from the page.
Use absolute image URLs.
Remove duplicate URLs.
Do not use tiny thumbnails when full-size URLs are available.
Do not include placeholder or lazy-loader blank images.
```

---

## SEO and Search Rules

Extract when available:

```json
{
  "seo": {
    "metaTitle": "Product SEO title",
    "metaDescription": "Product SEO description",
    "canonicalUrl": "https://brand.com/products/example",
    "ogImageUrl": "https://brand.com/og-image.jpg"
  }
}
```

Tags should be useful for product discovery only:

```
new arrival / summer / eid / cotton / regular fit / black
```

Do not include noisy internal campaign IDs.

---

## Raw Data Requirement

Always include raw source data.

```json
{
  "raw": {
    "sourceUrl": "https://brand.com/products/example",
    "scrapedAt": "2026-06-03T00:00:00.000Z",
    "brandProductJson": {},
    "htmlSections": [],
    "extractedSelectors": {}
  }
}
```

Raw data may contain brand-specific fields. Customer-facing fields must not.

---

## Common Brand Structure Examples

### Shopify

```
title         → title
body_html     → description + parsed sections
handle        → slug
vendor        → brand_name
product_type  → use as hint only; resolve division and category from adapter
variants[]    → variants
images[]      → images
options[]     → colors and sizes
tags          → tags
```

Do not use Shopify's `product_type` directly as Broady's `division`. Pass it through the brand adapter.

### Custom Brand JSON

Alias mappings:

```
clr, colour, shade            → color
size_options, available_sizes → sizes
mrp, compare_at_price         → actual_price
selling_price, discounted     → sale_price
stock, quantity, inventory    → variant quantity or stockStatus
gallery, media                → images
```

### HTML Product Page

```
h1                          → title
price block                 → actual_price / sale_price
breadcrumb                  → page_context.breadcrumb_raw (feed into taxonomy resolution)
URL path segments           → page_context.url_segments (feed into taxonomy resolution)
color options (all)         → colors + variants
enabled/disabled sizes      → variants with stockStatus
product carousel            → images
accordion sections          → dedicated detail fields
meta tags                   → seo
canonical link              → product_url
```

---

## Validation Checklist Before Sending to Ingestion

Each product must pass:

```
title exists
product_url exists
actual_price exists and is greater than 0
main image exists
all image URLs are absolute
at least one size exists
at least one variant exists
all variants have SKU or stable generated SKU
all unavailable sizes are included with out_of_stock
description does not contain Fabric & Care, Returns, or Disclaimer sections
dedicated fields are not duplicated into additional_info
page_context object is present with scrape_url, url_segments, and breadcrumb_raw
gender is one of: men, women, boys, girls, or null (if unresolvable)
division is one of: top, bottom, footwear, accessory, or null (if unresolvable)
category is a Broady canonical value or null (if unresolvable)
sub_type is a Broady canonical sub-type value, or null
sub_type_confidence is set when sub_type is not null
raw data is included
```

---

## Never Do These

```
Do not place all accordion text into description.
Do not place Fabric & Care into Product Details.
Do not place Return & Exchange into Shipping & Delivery.
Do not place Disclaimer into additional_info.
Do not drop sold-out sizes.
Do not keep only the selected color.
Do not keep only one product image.
Do not invent fake stock quantities.
Do not send brand-specific unknown fields as customer-facing additional_info.
Do not use brand taxonomy values in division, category, or sub_type fields — use Broady canonical values only.
Do not use "Clothing" as a category value — it is not a Broady canonical category.
Do not use "Top", "Bottom", "Footwear", "Accessories" as category values — these are division values.
Do not approve or publish products from scraper output — Broady admin approval handles that.
Do not set mapping_status from the scraper — the ingestion pipeline sets it.
Do not skip page context extraction — it is Step 0, not optional.
```

---

## Recommended Final Scraper Payload

```json
{
  "external_product_id": "outfitters-shirt-emb-001",
  "external_source": "scraper",
  "brand_name": "Outfitters",
  "title": "Embedded Regular Fit Shirt",
  "slug": "embedded-regular-fit-shirt",
  "description": "A clean embedded shirt for everyday and semi-formal wear.",
  "gender": "men",
  "division": "top",
  "category": "shirt",
  "sub_type": "embedded",
  "sub_type_confidence": "explicit",
  "fit": "Regular Fit",
  "season": "SS-26",
  "collection": "New Arrivals",
  "product_url": "https://outfitters.com.pk/men/shirts/embedded/emb-001",
  "actual_price": 4990,
  "sale_price": 3490,
  "currency": "PKR",
  "label": "Sale",
  "colors": ["Black", "Navy"],
  "sizes": ["S", "M", "L", "XL"],
  "variants": [
    {
      "sku": "OTF-EMB-BLK-S",
      "color": "Black",
      "colorHex": "#000000",
      "size": "S",
      "fit": "Regular Fit",
      "pricePkr": 4990,
      "salePricePkr": 3490,
      "compareAtPricePkr": 4990,
      "stockStatus": "in_stock",
      "quantity": 8,
      "isActive": true
    },
    {
      "sku": "OTF-EMB-BLK-M",
      "color": "Black",
      "colorHex": "#000000",
      "size": "M",
      "fit": "Regular Fit",
      "pricePkr": 4990,
      "salePricePkr": 3490,
      "compareAtPricePkr": 4990,
      "stockStatus": "out_of_stock",
      "quantity": 0,
      "isActive": false
    },
    {
      "sku": "OTF-EMB-NVY-M",
      "color": "Navy",
      "colorHex": "#001F5B",
      "size": "M",
      "fit": "Regular Fit",
      "pricePkr": 4990,
      "salePricePkr": 3490,
      "compareAtPricePkr": 4990,
      "stockStatus": "in_stock",
      "quantity": 4,
      "isActive": true
    }
  ],
  "images": [
    {
      "sourceUrl": "https://outfitters.com.pk/images/emb-001-front.jpg",
      "url": "https://outfitters.com.pk/images/emb-001-front.jpg",
      "altText": "Embedded Regular Fit Shirt front view",
      "imageType": "main",
      "isPrimary": true,
      "sortOrder": 0
    },
    {
      "sourceUrl": "https://outfitters.com.pk/images/emb-001-back.jpg",
      "url": "https://outfitters.com.pk/images/emb-001-back.jpg",
      "altText": "Embedded Regular Fit Shirt back view",
      "imageType": "gallery",
      "isPrimary": false,
      "sortOrder": 1
    }
  ],
  "fabric_care": {
    "fabricType": "100% Cotton",
    "careInstructions": ["Machine wash cold", "Do not bleach", "Iron on low heat"]
  },
  "detail": {
    "fabricComposition": "100% Cotton",
    "careGuide": "Machine wash cold\nDo not bleach\nIron on low heat",
    "fitDetails": "Regular Fit",
    "modelDetails": "Model is wearing size M, height 6'1\"",
    "returnExchangePolicy": "Exchange within 7 days for unused items with tags intact.",
    "disclaimer": "Color may vary slightly due to screen calibration and lighting."
  },
  "shipping_delivery": {
    "estimatedDeliveryTime": "Delivered in 3-5 working days",
    "regions": ["Pakistan"],
    "charges": "Free above PKR 4,999"
  },
  "size_guide": {
    "details": ["Model wears size M", "Size up for relaxed fit"],
    "entries": [
      { "size": "S", "chest_cm": "86-90" },
      { "size": "M", "chest_cm": "91-96" },
      { "size": "L", "chest_cm": "97-102" }
    ]
  },
  "deliveries_returns": {
    "returnPolicy": "Exchange within 7 days for unused items.",
    "refundConditions": "Refund after quality check."
  },
  "seo": {
    "metaTitle": "Embedded Regular Fit Shirt — Outfitters",
    "metaDescription": "Shop the Embedded Regular Fit Shirt from Outfitters. Available in Black and Navy.",
    "canonicalUrl": "https://outfitters.com.pk/men/shirts/embedded/emb-001"
  },
  "additional_info": [
    {
      "label": "Estimated Delivery Time",
      "value": "Delivered in 3-5 working days"
    }
  ],
  "page_context": {
    "scrape_url": "https://outfitters.com.pk/men/shirts/embedded/emb-001",
    "url_segments": ["men", "shirts", "embedded"],
    "breadcrumb_raw": ["Men", "Shirts", "Embedded Shirts"],
    "gender_raw": "Men",
    "category_raw": "Shirts",
    "sub_type_raw": "Embedded Shirts"
  },
  "raw": {
    "sourceUrl": "https://outfitters.com.pk/men/shirts/embedded/emb-001",
    "scrapedAt": "2026-06-07T00:00:00.000Z",
    "brandProductJson": {},
    "htmlSections": [],
    "extractedSelectors": {}
  }
}
```
