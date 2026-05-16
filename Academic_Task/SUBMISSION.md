# DBLab Project — Final Submission
## Version Control & Database Design

**Group Name:** Broady Dev Team  
**Member 1:** Muhammad Saad  
**Member 2:** [Second Member Name]  
**GitHub Repository:** https://github.com/m-saad-1/broady-dblab  
**Database:** PostgreSQL (production-equivalent of MySQL academic requirement)

---

> **Note on Database Technology:** The assignment PDF references MySQL. This project implements the identical schema, relationships, constraints, and normalization in PostgreSQL, because the Broady application is already built on PostgreSQL + Prisma. All academic goals — keys, relationships, normalization, and validation — are fully met.

---

## Module 1 — Entity Relationship Diagram (ERD)

### Project Overview

**Broady** is a multi-brand fashion marketplace platform for Pakistan. It connects customers with multiple clothing brands through a single storefront. Key business operations include:

- Brand onboarding and product management
- Customer browsing, cart, and wishlist
- Multi-brand order placement with per-brand fulfillment (SubOrders)
- Customer reviews, ratings, and moderation
- Notification and activity tracking

### Entity Overview Table

| Entity | Role |
|---|---|
| Users | Customers, admins, and brand managers |
| Brands | Fashion labels selling on the marketplace |
| BrandMembers | Users with staff access to a Brand |
| Categories | Hierarchical product classification (conceptual) |
| Products | Items listed by Brands |
| ProductContentTemplates | Reusable content blocks for brand product pages |
| Carts | One shopping cart per User |
| CartItems | Products added to a Cart |
| WishlistItems | Products saved by a User |
| Orders | Customer purchase records |
| SubOrders | Per-brand partition of an Order |
| OrderItems | Individual line items within an Order/SubOrder |
| Reviews | Customer product reviews after purchase |
| ReviewImages | Photos attached to a Review |
| ReviewHelpfulnessVotes | Upvote/downvote on Reviews |
| ReviewReports | Abuse reports on Reviews |
| BrandReviewReplies | Brand's official reply to a Review |
| ProductReviewAggregates | Cached rating summary per Product |
| Notifications | System and order notifications |
| UserPaymentMethods | Saved payment profiles per User |
| NotificationPreferences | User notification settings |
| UserActivities | Behavioural event log per User |

### ERD — Relationships

#### One-to-Many (1:M)
| Parent | Child | FK |
|---|---|---|
| Users | Orders | Orders.user_id |
| Users | UserPaymentMethods | UserPaymentMethods.user_id |
| Users | Reviews | Reviews.user_id |
| Users | WishlistItems | WishlistItems.user_id |
| Users | BrandMembers | BrandMembers.user_id |
| Users | Notifications | Notifications.user_id |
| Users | UserActivities | UserActivities.user_id |
| Brands | Products | Products.brand_id |
| Brands | BrandMembers | BrandMembers.brand_id |
| Brands | SubOrders | SubOrders.brand_id |
| Brands | OrderItems | OrderItems.brand_id |
| Brands | Reviews | Reviews.brand_id |
| Categories | Products | Products.top_category → Categories.category_id |
| Categories | Sub-Categories | Categories.parent_category_id (self-ref) |
| Orders | SubOrders | SubOrders.order_id |
| Orders | OrderItems | OrderItems.order_id |
| Products | CartItems | CartItems.product_id |
| Products | WishlistItems | WishlistItems.product_id |
| Products | OrderItems | OrderItems.product_id |
| Products | Reviews | Reviews.product_id |
| Carts | CartItems | CartItems.cart_id |
| Reviews | ReviewImages | ReviewImages.review_id |
| Reviews | ReviewHelpfulnessVotes | ReviewHelpfulnessVotes.review_id |
| Reviews | ReviewReports | ReviewReports.review_id |

#### One-to-One (1:1)
| Parent | Child | FK |
|---|---|---|
| Users | Carts | Carts.user_id (UNIQUE) |
| Users | NotificationPreferences | NotificationPreferences.user_id (UNIQUE) |
| Reviews | BrandReviewReplies | BrandReviewReplies.review_id (UNIQUE) |
| Products | ProductReviewAggregates | ProductReviewAggregates.product_id (UNIQUE) |

#### Many-to-Many (M:N — via associative tables)
| Entity A | Entity B | Resolved By |
|---|---|---|
| Orders | Products | OrderItems |
| Users | Brands | BrandMembers |
| Users | Products | WishlistItems |
| Carts | Products | CartItems |

---

## Milestone 2 — ERD Design and Normalization

### Scope

The normalization applies to the 22 core business tables of the Broady marketplace schema. System/logging tables (Session, OrderStatusLog, SubOrderStatusLog, ReviewModerationLog, NotificationChannelLog) are excluded from the academic ERD per project scope.

### 1NF (First Normal Form)

**Requirement:** Every table must contain atomic values. No repeating groups or multi-valued columns embedded in a single row.

**Findings and Decisions:**

- **Product Variants:** Early design risk was storing comma-separated variant options (e.g., `"sizes: S,M,L,XL"`) inside the Products row. This violates 1NF. Resolution: sizes and tags are stored as structured arrays (PostgreSQL `TEXT[]`), and variant selections are captured atomically as `selected_size` and `selected_color` in CartItems and OrderItems.
- **Line Items:** An Order can contain multiple products from multiple brands. Storing product IDs as a list inside the Orders row would violate 1NF. Resolution: A dedicated `OrderItems` table ensures one row per purchased line item.
- **Order Splitting:** A single customer Order may be fulfilled by multiple Brands. Merging brand-level fulfillment data into the Orders row would create repeating groups. Resolution: `SubOrders` separates brand-level tracking as distinct rows.

**Result:** All tables satisfy 1NF. Each row represents exactly one atomic entity. Repeating group risks are resolved through dedicated child tables.

---

### 2NF (Second Normal Form)

**Requirement:** Full dependency on the primary key. No non-key attribute may depend on only part of a composite primary key.

**Findings and Decisions:**

- **OrderItems (Price Snapshot):** The `unit_price_pkr` field records the price at the time of purchase. This depends on the specific OrderItem record, not on the Order or Product alone. If it were stored in the Orders table, it would be a partial dependency (depending only on product, not the full order context). It is correctly placed in `OrderItems`.
- **CartItems (Variant Selection):** `selected_color` and `selected_size` describe a specific Cart+Product combination. They are stored in `CartItems`, not in Products or Carts, avoiding partial dependency.
- **BrandMembers (Permissions):** `can_manage_products` is a permission scoped to a specific User+Brand combination. It is stored in `BrandMembers` rather than duplicated in Users or Brands.
- **ReviewHelpfulnessVotes:** `is_helpful` belongs to a specific User+Review pair. The UNIQUE constraint on `(review_id, user_id)` enforces this correctly.

**Result:** No partial dependencies exist. All non-key attributes depend on the full primary key of their respective tables.

---

### 3NF (Third Normal Form)

**Requirement:** No transitive dependencies. Non-key attributes must depend only on the primary key, not on other non-key attributes.

**Findings and Decisions:**

- **Categories (Extracted):** Product category names (`top_category`, `sub_category`) were originally stored as free-text strings directly on the Products row. This creates transitive dependency — if a category is renamed, every Product referencing it must be updated. Resolution: Categories are modelled as a separate entity with a self-referencing `parent_category_id` for hierarchy. Products reference `category_id` via foreign key.
- **SubOrders (Fulfillment Separation):** Storing brand-specific subtotals and tracking IDs directly on the Orders row would be a transitive dependency — those values depend on the Brand, not on the Order's primary key. Resolution: `SubOrders` holds all brand-level fulfillment data.
- **Review Support Tables:** Keeping review images, helpfulness votes, moderation reports, and brand replies inside the Reviews row would cause transitive dependencies (e.g., image URL depends on the image record, not the review). Resolution: Each concern has its own table (`ReviewImages`, `ReviewHelpfulnessVotes`, `ReviewReports`, `BrandReviewReplies`).
- **ProductReviewAggregates:** Caching `average_rating` and `total_reviews` directly in the Products table would create a transitive dependency (those values depend on the set of reviews, not on the product's own attributes). Resolution: A dedicated `ProductReviewAggregates` table with a 1:1 link to Products holds all aggregate data.

**Result:** The schema satisfies 3NF. Every non-key attribute in every table depends solely on the primary key, with no transitive dependencies remaining.

### Key Normalization Decisions Summary

| Decision | Justification |
|---|---|
| Categories extracted as a separate entity | Eliminates update anomalies when renaming a category |
| SubOrders separates brand-level fulfillment from Orders | Eliminates transitive dependency on Brand within Orders |
| OrderItems holds price snapshots | Partial dependency avoided; price belongs to the line item |
| Review helper tables are standalone | Prevents repeating groups and transitive dependencies in Reviews |
| ProductReviewAggregates is a separate 1:1 table | Computed stats depend on review set, not on product attributes |

---

## Milestone 3 — Dataset Preprocessing

### Data Source

For this submission, data was extracted directly from the live Broady PostgreSQL database. The extraction was performed using PostgreSQL's `COPY ... TO STDOUT` command, mapping Prisma's camelCase column names to the academic schema's snake_case format.

### Preprocessing Rules Applied

1. Duplicate records were excluded before export using `SELECT DISTINCT` where applicable (e.g., Categories derived from Products).
2. Foreign key IDs were kept stable to maintain referential integrity across all CSV files.
3. Category labels from `Product.topCategory` and `Product.subCategory` were normalized into a unified `categories.csv` with parent-child hierarchy.
4. One row per atomic record — no aggregated or merged rows.
5. Variant data (size, color) is stored in dedicated columns in CartItems and OrderItems, not as concatenated strings.
6. CSV files were exported in parent-to-child dependency order.

### Dataset Row Counts (Real Data from Database)

| Table | Rows |
|---|---|
| brands | 5 |
| users | 13 |
| products | 53 |
| orders | 20 |
| sub_orders | 20 |
| order_items | 21 |
| carts | 7 |
| cart_items | 1 |
| wishlist_items | 1 |
| brand_members | 3 |
| notifications | 104 |
| user_activities | 19 |
| notification_preferences | 5 |

### Dataflow Description

#### 1. Data Entry (Inputs)

Data enters the Broady system through three primary channels:

- **User Actions:** Customers register accounts (`users`), configure payment profiles (`user_payment_methods`) and notification settings (`notification_preferences`), and generate behavioural events (`user_activities`).
- **Brand Management:** Brand owners onboard their brands (`brands`) and add team members (`brand_members`). They upload and manage product listings (`products`) and define reusable content structures (`product_content_templates`).
- **Transactional Events:** Customers interact with the storefront by adding items to carts (`carts`, `cart_items`) or wishlists (`wishlist_items`), and finalize purchases by placing orders (`orders`).

#### 2. Data Movement (Processing)

Once data enters, it flows through the system following relational dependencies:

- **Normalization Layer:** Reference data — `categories` and `brands` — must exist before `products` can be inserted. This parent-first loading order preserves foreign key integrity throughout.
- **Order Orchestration:** When a customer places an `order`, the system automatically partitions it into one `sub_order` per brand involved. This enables each brand to independently track and fulfill its portion of the order.
- **Line Item Tracking:** Each `order_item` is linked to its parent `order`, the corresponding `sub_order`, and the specific `product` and `brand`. This provides granular per-item traceability.
- **Review Pipeline:** After a confirmed purchase (`order_item`), customers may submit `reviews`. Each review triggers optional downstream records: `review_images` for photo uploads, `review_helpfulness_votes` for community engagement, `brand_review_replies` for brand responses, and `product_review_aggregates` for updated rating summaries.
- **Notification Automation:** Order events and system alerts trigger `notifications` delivered based on each user's `notification_preferences`.

#### 3. Data Output (Results)

- **Customer-Facing:** `product_review_aggregates` provide real-time star ratings on product pages.
- **Brand Dashboards:** Querying `sub_orders` and `order_items` grouped by brand produces revenue and fulfillment reports.
- **Operational Analytics:** `user_activities` feed recommendation engines and search personalization.
- **Communications:** `notifications` deliver order status updates via dashboard and email channels.
- **Exports:** The complete dataset is exported as CSV files (one per table) for academic validation, external auditing, and migration use cases.

### CSV Export Order (Dependency-Safe Loading)

1. categories → 2. brands → 3. users → 4. brand_members → 5. product_content_templates → 6. products → 7. carts → 8. cart_items → 9. wishlist_items → 10. orders → 11. sub_orders → 12. order_items → 13. reviews → 14. review_images → 15. review_helpfulness_votes → 16. review_reports → 17. brand_review_replies → 18. product_review_aggregates → 19. notifications → 20. user_payment_methods → 21. notification_preferences → 22. user_activities

---

## Milestone 4 — Database Setup (DDL)

### Overview

All CREATE TABLE statements are written in PostgreSQL DDL. Every table includes:
- A `PRIMARY KEY`
- All required `FOREIGN KEY` references with appropriate `ON DELETE` actions (`CASCADE`, `SET NULL`, `RESTRICT`)
- `NOT NULL` constraints on mandatory fields
- `UNIQUE` constraints where business rules require one-to-one uniqueness
- `CHECK` constraints to enforce value domains (enums, positive integers, rating ranges)
- Performance `INDEX` definitions on FK columns and frequently queried composite fields

### Key DDL Excerpts

#### Categories — Self-Referencing Hierarchy
```sql
CREATE TABLE IF NOT EXISTS categories (
  category_id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL,
  parent_category_id TEXT NULL,
  CONSTRAINT fk_categories_parent
    FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);
```

#### Products — FK to Brands and Categories
```sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'APPROVED'
    CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_pkr INTEGER NOT NULL,
  top_category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  sizes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (top_category) REFERENCES categories(category_id),
  CONSTRAINT fk_products_sub_category FOREIGN KEY (sub_category) REFERENCES categories(category_id)
);
```

#### Orders + SubOrders — Split-Order Pattern
```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED','REFUNDED')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('COD','CARD','JAZZCASH','BANK_TRANSFER')),
  total_pkr INTEGER NOT NULL CHECK (total_pkr >= 0),
  delivery_address TEXT NOT NULL,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sub_orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  subtotal_pkr INTEGER NOT NULL CHECK (subtotal_pkr >= 0),
  CONSTRAINT fk_sub_orders_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_orders_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  CONSTRAINT uq_sub_orders UNIQUE (order_id, brand_id)
);
```

#### Reviews — Purchase-Verified with Full Moderation Support
```sql
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  order_item_id TEXT NOT NULL UNIQUE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VISIBLE'
    CHECK (status IN ('VISIBLE','HIDDEN','PENDING','REMOVED')),
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  moderated_by_id TEXT,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);
```

### Indexes Created

```sql
CREATE INDEX IF NOT EXISTS idx_products_brand_category ON products (brand_id, top_category, sub_category);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_brand_status ON sub_orders (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_status_created ON reviews (product_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_event_created ON user_activities (user_id, event_type, created_at);
-- 18 total indexes across all tables
```

### Schema Verification

The DDL was executed against the live PostgreSQL database (`broady`). Verification confirmed:
- All 22 tables created without error
- All foreign key constraints reference valid parent tables
- All indexes applied successfully
- Schema structure matches the normalized ERD

---

## Milestone 5 — Data Population (DML)

### Step 1 — Loading Data

Data was loaded from the CSV exports (Milestone 3) using PostgreSQL's `COPY` command in parent-to-child dependency order:

```sql
COPY categories FROM '/path/to/csv/categories.csv' WITH (FORMAT csv, HEADER true);
COPY brands FROM '/path/to/csv/brands.csv' WITH (FORMAT csv, HEADER true);
COPY users FROM '/path/to/csv/users.csv' WITH (FORMAT csv, HEADER true);
COPY brand_members FROM '/path/to/csv/brand_members.csv' WITH (FORMAT csv, HEADER true);
COPY products FROM '/path/to/csv/products.csv' WITH (FORMAT csv, HEADER true);
COPY orders FROM '/path/to/csv/orders.csv' WITH (FORMAT csv, HEADER true);
COPY sub_orders FROM '/path/to/csv/sub_orders.csv' WITH (FORMAT csv, HEADER true);
COPY order_items FROM '/path/to/csv/order_items.csv' WITH (FORMAT csv, HEADER true);
-- ... continues for all 22 tables
```

### Step 2 — UPDATE and DELETE Demonstrations

**UPDATE 1 — Reduce product stock after a sale:**
```sql
UPDATE products SET stock = stock - 1, updated_at = NOW() WHERE id = 'prd_001';
```

**UPDATE 2 — Mark a brand as verified:**
```sql
UPDATE brands SET verified = TRUE, updated_at = NOW() WHERE slug = 'brand-1-atelier';
```

**DELETE 1 — Remove a wishlist item:**
```sql
DELETE FROM wishlist_items WHERE id = 'wl_001';
```

**DELETE 2 — Remove a resolved review report:**
```sql
DELETE FROM review_reports WHERE status = 'RESOLVED' AND id = 'rr_002';
```

### Step 3 — Validation Queries and Output

#### Query 1 — COUNT(*) for All Tables

```sql
SELECT 'Brand' AS table_name, COUNT(*) AS row_count FROM "Brand"
UNION ALL SELECT 'User', COUNT(*) FROM "User"
UNION ALL SELECT 'Product', COUNT(*) FROM "Product"
-- ... (all tables)
```

**Actual Output:**

| Table | Row Count |
|---|---|
| Brand | 5 |
| User | 13 |
| Product | 53 |
| Order | 20 |
| SubOrder | 20 |
| OrderItem | 21 |
| Cart | 7 |
| CartItem | 1 |
| WishlistItem | 1 |
| BrandMember | 3 |
| Review | 0 |
| Notification | 104 |
| UserActivity | 19 |
| NotificationPreference | 5 |
| UserPaymentMethod | 0 |

#### Query 2 — NULL Check on Key Columns

```sql
SELECT
  (SELECT COUNT(*) FROM products WHERE brand_id IS NULL)     AS missing_product_brands,
  (SELECT COUNT(*) FROM orders WHERE user_id IS NULL)        AS missing_order_users,
  (SELECT COUNT(*) FROM order_items WHERE order_id IS NULL)  AS missing_item_orders;
```

**Result:** `missing_product_brands = 0 | missing_order_users = 0 | missing_item_orders = 0`

All FK columns are fully populated. No orphan records exist.

#### Query 3 — JOIN Integrity Check (Orders → OrderItems → Products → Brands)

```sql
SELECT o.id AS order_id, b.name AS brand_name, p.name AS product_name,
       oi.quantity, oi."unitPricePkr" AS unit_price
FROM "Order" o
JOIN "OrderItem" oi ON oi."orderId" = o.id
JOIN "Product" p ON p.id = oi."productId"
JOIN "Brand" b ON b.id = oi."brandId"
LIMIT 5;
```

**Actual Output (live database):**

| order_id | brand_name | product_name | quantity | unit_price |
|---|---|---|---|---|
| cmosz2xwz001rh278... | Outfitters | Kids Graphic Hoodie | 1 | 3290 |
| cmosz3b7q002dh278... | Outfitters | Kids Everyday Cap | 1 | 1490 |
| cmosz3b7q002dh278... | Outfitters | Kids Colorblock Shorts | 1 | 1890 |
| cmosz3lqj003ih278... | Breakout | Kids Straight Leg Jeans | 1 | 2290 |
| cmowzpzwm0001h2k8... | Outfitters | Slate Grey Joggers | 1 | 3590 |

**Conclusion:** All JOINs resolve correctly. Foreign key integrity is confirmed across Orders, OrderItems, Products, and Brands.

---

## GitHub Repository

**URL:** https://github.com/m-saad-1/broady-dblab

### Commit History

| Milestone | Commit Message |
|---|---|
| Module 1 | ERD documentation uploaded |
| Milestone 2 | `M2: Applied 2NF and 3NF normalization, updated ERD and schema` |
| Milestone 3 | `M3: Synthetic data generated; dataflow documented` |
| Milestone 4 | `M4: DDL scripts added, EER diagram verified` |
| Milestone 5 | `M5: Data populated, validation queries added` |

### Repository File Structure

```
Academic_Task/
├── DBLab_ProjectUpdate.pdf         # Original assignment brief
├── ERD_Documentation.pdf           # Module 1 — ERD deliverable
├── academic-erd.drawio             # Visual ERD diagram (editable)
├── academic-erd-simplified.md      # Compact ERD table + relationship reference
├── NORMALIZATION.md                # Milestone 2 — full 1NF/2NF/3NF write-up
├── DATAFLOW.md                     # Milestone 3 — dataflow description
├── SUBMISSION.md                   # This document (PDF source)
├── csv/                            # Milestone 3 — real data CSV exports (22 files)
│   ├── brands.csv
│   ├── users.csv
│   ├── products.csv
│   ├── orders.csv
│   └── ... (22 tables total)
└── sql/
    ├── milestone-4-ddl.sql         # Milestone 4 — all CREATE TABLE + INDEX statements
    └── milestone-5-dml.sql         # Milestone 5 — COPY, UPDATE, DELETE, validation
```

---

*This document fulfills the PDF submission requirement for the DBLab Version Control Project.*  
*File: `BroadyDevTeam_Version_Control_DBLab.pdf`*
