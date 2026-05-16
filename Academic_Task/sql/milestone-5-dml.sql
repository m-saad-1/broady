-- Milestone 5 - Data Population (DML)
-- This script provides instructions for loading the generated CSV dataset,
-- includes required UPDATE/DELETE demonstrations, and validation queries.

BEGIN;

/*
STEP 1: Load Data from CSV
PostgreSQL users can use the COPY command to load the generated CSV files.
Note: Replace '/absolute/path/to/csv/' with the actual path on your machine.
The loading order must be followed to preserve referential integrity.

COPY categories FROM '/path/to/csv/categories.csv' WITH (FORMAT csv, HEADER true);
COPY brands FROM '/path/to/csv/brands.csv' WITH (FORMAT csv, HEADER true);
COPY users FROM '/path/to/csv/users.csv' WITH (FORMAT csv, HEADER true);
COPY brand_members FROM '/path/to/csv/brand_members.csv' WITH (FORMAT csv, HEADER true);
COPY product_content_templates FROM '/path/to/csv/product_content_templates.csv' WITH (FORMAT csv, HEADER true);
COPY products FROM '/path/to/csv/products.csv' WITH (FORMAT csv, HEADER true);
COPY carts FROM '/path/to/csv/carts.csv' WITH (FORMAT csv, HEADER true);
COPY cart_items FROM '/path/to/csv/cart_items.csv' WITH (FORMAT csv, HEADER true);
COPY wishlist_items FROM '/path/to/csv/wishlist_items.csv' WITH (FORMAT csv, HEADER true);
COPY orders FROM '/path/to/csv/orders.csv' WITH (FORMAT csv, HEADER true);
COPY sub_orders FROM '/path/to/csv/sub_orders.csv' WITH (FORMAT csv, HEADER true);
COPY order_items FROM '/path/to/csv/order_items.csv' WITH (FORMAT csv, HEADER true);
COPY reviews FROM '/path/to/csv/reviews.csv' WITH (FORMAT csv, HEADER true);
COPY review_images FROM '/path/to/csv/review_images.csv' WITH (FORMAT csv, HEADER true);
COPY review_helpfulness_votes FROM '/path/to/csv/review_helpfulness_votes.csv' WITH (FORMAT csv, HEADER true);
COPY review_reports FROM '/path/to/csv/review_reports.csv' WITH (FORMAT csv, HEADER true);
COPY brand_review_replies FROM '/path/to/csv/brand_review_replies.csv' WITH (FORMAT csv, HEADER true);
COPY product_review_aggregates FROM '/path/to/csv/product_review_aggregates.csv' WITH (FORMAT csv, HEADER true);
COPY notifications FROM '/path/to/csv/notifications.csv' WITH (FORMAT csv, HEADER true);
COPY user_payment_methods FROM '/path/to/csv/user_payment_methods.csv' WITH (FORMAT csv, HEADER true);
COPY notification_preferences FROM '/path/to/csv/notification_preferences.csv' WITH (FORMAT csv, HEADER true);
COPY user_activities FROM '/path/to/csv/user_activities.csv' WITH (FORMAT csv, HEADER true);
*/

-- STEP 2: Demonstrate UPDATE and DELETE (Required)

-- Example 1: Update product stock after a simulated sale
UPDATE products
SET stock = stock - 1,
    updated_at = NOW()
WHERE id = 'prd_001';

-- Example 2: Update brand verification status
UPDATE brands
SET verified = TRUE,
    updated_at = NOW()
WHERE slug = 'brand-1-atelier';

-- Example 3: Delete a specific wishlist item
DELETE FROM wishlist_items
WHERE id = 'wl_001';

-- Example 4: Remove a resolved report
DELETE FROM review_reports
WHERE status = 'RESOLVED' AND id = 'rr_002';


-- STEP 3: Validation Queries

-- 1. Row Count Validation for all core tables
SELECT 'categories' AS table_name, COUNT(*) AS row_count FROM categories
UNION ALL SELECT 'brands', COUNT(*) FROM brands
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'brand_members', COUNT(*) FROM brand_members
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_content_templates', COUNT(*) FROM product_content_templates
UNION ALL SELECT 'carts', COUNT(*) FROM carts
UNION ALL SELECT 'cart_items', COUNT(*) FROM cart_items
UNION ALL SELECT 'wishlist_items', COUNT(*) FROM wishlist_items
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'sub_orders', COUNT(*) FROM sub_orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'review_images', COUNT(*) FROM review_images
UNION ALL SELECT 'review_helpfulness_votes', COUNT(*) FROM review_helpfulness_votes
UNION ALL SELECT 'review_reports', COUNT(*) FROM review_reports
UNION ALL SELECT 'brand_review_replies', COUNT(*) FROM brand_review_replies
UNION ALL SELECT 'product_review_aggregates', COUNT(*) FROM product_review_aggregates
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'user_payment_methods', COUNT(*) FROM user_payment_methods
UNION ALL SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
UNION ALL SELECT 'user_activities', COUNT(*) FROM user_activities;

-- 2. NULL Checks on key columns
SELECT 
    (SELECT COUNT(*) FROM products WHERE brand_id IS NULL) AS missing_product_brands,
    (SELECT COUNT(*) FROM orders WHERE user_id IS NULL) AS missing_order_users,
    (SELECT COUNT(*) FROM order_items WHERE order_id IS NULL) AS missing_item_orders;

-- 3. JOIN Integrity Check: Verify that all order items belong to valid products and brands
SELECT oi.id, p.name AS product_name, b.name AS brand_name, o.status AS order_status
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN brands b ON oi.brand_id = b.id
JOIN orders o ON oi.order_id = o.id
LIMIT 10;

-- 4. Review Integrity Check: Link reviews to their products and reviewers
SELECT r.id AS review_id, r.rating, p.name AS product_name, u.email AS reviewer_email
FROM reviews r
JOIN products p ON r.product_id = p.id
JOIN users u ON r.user_id = u.id
LIMIT 10;

COMMIT;