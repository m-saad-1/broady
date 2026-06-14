### Refined Question



# 2. Product-Level Details

These fields describe the main product.

| Field                 |    Required | Notes                                                |
| --------------------- | ----------: | ---------------------------------------------------- |
| `id`                  |         Yes | Broady internal product ID                           |
| `external_product_id` | Recommended | Product ID from brand/source website                 |
| `brand_id`            |         Yes | Linked to Brand table                                |
| `brand_name`          |         Yes | Example: Outfitters                                  |
| `title`               |         Yes | Clean product name                                   |
| `slug`                |         Yes | SEO-friendly URL                                     |
| `short_description`   | Recommended | Brief product summary                                |
| `description`         |         Yes | Full product description                             |
| `gender`              |         Yes | Men, Women, Kids, Unisex                             |
| `category`            |         Yes | Clothing, Shoes, Accessories                         |
| `subcategory`         |         Yes | Shirts, Jeans, Dresses, T-Shirts                     |
| `product_type`        | Recommended | More specific type: polo shirt, wide-leg jeans       |
| `fit`                 | Recommended | Regular, Slim, Relaxed, Oversized                    |
| `season`              |    Optional | SS-26, FW-25, Summer, Winter                         |
| `collection`          |    Optional | New Arrival, Eid Collection, Essentials              |
| `status`              |         Yes | draft, pending, approved, active, rejected, archived |
| `visibility`          |         Yes | visible, hidden                                      |
| `source`              |         Yes | manual, brand_upload, json_import, scraper, feed     |
| `product_url`         | Recommended | Original brand product URL                           |
| `created_at`          |         Yes | System timestamp                                     |
| `updated_at`          |         Yes | System timestamp                                     |

---

# 3. Pricing Details

Pricing should be clear and consistent.

| Field                               | Required | Notes                                              |
| ----------------------------------- | -------: | -------------------------------------------------- |
| `actual_price` / `compare_at_price` |      Yes | Original price                                     |
| `discounted_price` / `sale_price`   | Optional | Sale price if discount exists                      |
| `final_price`                       |      Yes | Price customer pays                                |
| `currency`                          |      Yes | PKR                                                |
| `discount_percentage`               |     Auto | Calculate automatically                            |
| `is_on_sale`                        |     Auto | True only if sale price is lower than actual price |
| `label`                             | Optional | Sale, New, Limited, Trending, Exclusive            |
| `sale_start_date`                   | Optional | For scheduled campaigns                            |
| `sale_end_date`                     | Optional | For scheduled campaigns                            |

Important rule:

```text
If discount = 0%, do not show sale badge.
If actual_price = discounted_price, show only one price.
```

---

# 4. Variant Details

This is one of the most important parts.

Each color-size combination should be stored as a variant.

| Field                 |    Required | Notes                             |
| --------------------- | ----------: | --------------------------------- |
| `variant_id`          |         Yes | Broady internal variant ID        |
| `external_variant_id` | Recommended | Brand/source variant ID           |
| `product_id`          |         Yes | Parent product                    |
| `sku`                 |         Yes | Stock Keeping Unit                |
| `barcode`             |    Optional | If brand provides it              |
| `color_name`          | Recommended | Black, White, Navy                |
| `color_hex`           |    Optional | `#000000`, `#FFFFFF`              |
| `size`                | Recommended | XS, S, M, L, XL                   |
| `fit`                 |    Optional | If fit differs by variant         |
| `price`               |         Yes | Variant price                     |
| `compare_at_price`    |    Optional | Variant original price            |
| `stock_quantity`      | Recommended | Actual stock if known             |
| `stock_status`        |         Yes | in_stock, low_stock, out_of_stock |
| `low_stock_threshold` |    Optional | Example: alert below 5            |
| `weight`              |    Optional | Useful for shipping               |
| `is_available`        |         Yes | Whether user can buy this variant |

For MVP, if you do not know exact stock quantity, use:

```text
stock_status = in_stock / out_of_stock
```

Later, move toward exact quantity.

---

# 5. Color Structure

Do not store colors as messy text only. Normalize them.

| Field                | Example                       |
| -------------------- | ----------------------------- |
| `color_name`         | Black                         |
| `normalized_color`   | black                         |
| `color_hex`          | #000000                       |
| `color_swatch_image` | optional image                |
| `variant_ids`        | variants linked to this color |

This helps filters like:

```text
Men polo shirts in black color
```

---

# 6. Size Structure

Sizes should also be normalized.

| Field             | Example                 |
| ----------------- | ----------------------- |
| `size_label`      | M                       |
| `normalized_size` | medium                  |
| `size_type`       | alpha / numeric / waist |
| `available`       | true                    |
| `variant_id`      | linked variant          |

For fashion, size can be complicated. Support:

```text
XS, S, M, L, XL
28, 30, 32, 34
One Size
```

---

# 7. Media / Image Details

Do not keep only one image URL. Store images separately.

| Field        |    Required | Notes                                        |
| ------------ | ----------: | -------------------------------------------- |
| `image_id`   |         Yes | Internal ID                                  |
| `product_id` |         Yes | Linked product                               |
| `variant_id` |    Optional | If image belongs to a specific color/variant |
| `image_url`  |         Yes | Original or uploaded image                   |
| `cdn_url`    | Recommended | Optimized delivery URL later                 |
| `alt_text`   | Recommended | SEO/accessibility                            |
| `position`   |         Yes | Image order                                  |
| `image_type` |         Yes | main, gallery, size_guide, swatch            |
| `width`      |    Optional | If available                                 |
| `height`     |    Optional | If available                                 |

Recommended product media:

```text
main_image_url
gallery_images[]
variant_images[]
size_guide_image_url
swatch_images[]
video_url optional
```

---

# 8. Product Detail Blocks

This is where your “additional details” should go.

Instead of dumping everything into `description`, create separate structured fields.

| Field                    | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `fabric_composition`     | Cotton 100%, Polyester blend, Denim, etc.      |
| `care_guide`             | Machine wash, dry clean, do not bleach         |
| `fit_details`            | Regular fit, oversized fit, model wearing M    |
| `model_details`          | Model height, size worn                        |
| `size_guide_text`        | Size chart explanation                         |
| `size_guide_image_url`   | Size chart image                               |
| `shipping_delivery`      | Shipping info                                  |
| `return_exchange_policy` | Return/exchange rules                          |
| `disclaimer`             | Color may vary, sale item non-returnable, etc. |
| `material_details`       | Fabric type, stretch, thickness                |
| `origin`                 | Made in Pakistan, Imported, etc.               |
| `package_includes`       | 1 shirt, 1 trouser, etc.                       |

Important rule:

```text
If a field is missing, do not show the section on product detail page.
```

Example: if there is no size guide image, do not show an empty “Size Guide” block.

---

# 9. Shipping and Delivery Details

Shipping should be product/brand-aware.

| Field                         |    Required | Notes                           |
| ----------------------------- | ----------: | ------------------------------- |
| `estimated_delivery_min_days` | Recommended | Example: 3                      |
| `estimated_delivery_max_days` | Recommended | Example: 5                      |
| `delivery_text`               | Recommended | “Delivered in 3–5 working days” |
| `shipping_fee`                |    Optional | If product/brand-specific       |
| `free_shipping_available`     |    Optional | True/false                      |
| `cod_available`               | Recommended | Cash on delivery allowed        |
| `return_available`            | Recommended | True/false                      |
| `exchange_available`          | Recommended | True/false                      |
| `return_window_days`          | Recommended | Example: 7 days                 |
| `exchange_window_days`        | Recommended | Example: 7 days                 |

---

# 10. Search, Filter, and Recommendation Fields

These fields help catalog, filters, search, and “For You”.

| Field              | Purpose                       |
| ------------------ | ----------------------------- |
| `tags`             | shirt, summer, cotton, casual |
| `search_keywords`  | generated keywords            |
| `normalized_title` | cleaned title                 |
| `gender_filter`    | Men/Women/Kids                |
| `category_filter`  | normalized category           |
| `brand_filter`     | normalized brand              |
| `color_filters`    | black, white, blue            |
| `size_filters`     | S, M, L                       |
| `price_bucket`     | under 2000, 2000–5000         |
| `style_tags`       | casual, formal, streetwear    |
| `occasion_tags`    | daily wear, party, office     |
| `season_tags`      | summer, winter                |

For example, a product should be searchable through:

```text
black polo shirt men
men polo shirts with black color
Outfitters black shirt
summer casual shirt
```

---

# 11. SEO Fields

Useful for Google indexing and clean URLs.

| Field              |    Required | Notes                                      |
| ------------------ | ----------: | ------------------------------------------ |
| `slug`             |         Yes | `/products/outfitters-scoop-neck-tank-top` |
| `meta_title`       | Recommended | SEO title                                  |
| `meta_description` | Recommended | SEO description                            |
| `canonical_url`    |    Optional | Avoid duplicate SEO issues                 |
| `og_image_url`     |    Optional | Social share image                         |

---

# 12. Admin / Approval Fields

Because Broady approves brand products before going live.

| Field              | Required | Notes                       |
| ------------------ | -------: | --------------------------- |
| `approval_status`  |      Yes | pending, approved, rejected |
| `approved_by`      | Optional | Admin ID                    |
| `approved_at`      | Optional | Approval timestamp          |
| `rejection_reason` | Optional | If rejected                 |
| `created_by_role`  |      Yes | admin, brand                |
| `created_by_id`    |      Yes | User/admin/brand account    |
| `last_updated_by`  | Optional | Track updates               |
| `quality_score`    | Optional | Internal quality rating     |

---

# 13. Import / Source Tracking Fields

Very important for your JSON/CSV ingestion system.

| Field               |    Required | Notes                                  |
| ------------------- | ----------: | -------------------------------------- |
| `import_batch_id`   | Recommended | Which import file created this product |
| `source_format`     | Recommended | shopify_json, csv, manual, scraper     |
| `source_brand_name` | Recommended | Brand name from file                   |
| `raw_product_data`  | Recommended | Store raw JSON for debugging           |
| `mapping_status`    | Recommended | mapped, needs_review, failed           |
| `validation_errors` |    Optional | Missing price, image, etc.             |
| `last_synced_at`    |    Optional | For future feed/API sync               |

Do not throw away raw data. Keep it for debugging and future re-processing.

---

# 14. Complete Broady Product Schema Summary

Use this as the final structure.

```text
Product
- id
- external_product_id
- brand_id
- title
- slug
- short_description
- description
- gender
- category
- subcategory
- product_type
- fit
- season
- collection
- tags
- product_url
- status
- approval_status
- visibility
- source
- created_at
- updated_at

ProductPricing
- product_id
- actual_price
- discounted_price
- final_price
- currency
- discount_percentage
- is_on_sale
- label
- sale_start_date
- sale_end_date

ProductVariant
- id
- external_variant_id
- product_id
- sku
- barcode
- color_name
- color_hex
- size
- fit
- price
- compare_at_price
- stock_quantity
- stock_status
- weight
- is_available

ProductImage
- id
- product_id
- variant_id
- image_url
- cdn_url
- alt_text
- position
- image_type
- width
- height

ProductDetails
- product_id
- fabric_composition
- care_guide
- fit_details
- model_details
- size_guide_text
- size_guide_image_url
- shipping_delivery
- return_exchange_policy
- disclaimer
- material_details
- origin
- package_includes

ProductShipping
- product_id
- estimated_delivery_min_days
- estimated_delivery_max_days
- delivery_text
- shipping_fee
- free_shipping_available
- cod_available
- return_available
- exchange_available
- return_window_days
- exchange_window_days

ProductSEO
- product_id
- meta_title
- meta_description
- canonical_url
- og_image_url

ProductImportMeta
- product_id
- import_batch_id
- source_format
- source_brand_name
- raw_product_data
- mapping_status
- validation_errors
- last_synced_at
```

---



---

# Final Recommendation

Broady should treat the **Product** as the parent entity and treat **size/color/SKU/stock/price combinations as Variants**. Keep product descriptions, policies, media, SEO, shipping, and import metadata in separate structured sections.

That gives you a clean, scalable product system that can ingest data from different brands without breaking your database every time a brand has a slightly different format.
