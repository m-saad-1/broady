-- Milestone 5 - sample data load, update/delete examples, and validation queries
-- Use the generated CSV dataset in Academic_Task/csv/ to populate the schema.
-- This script includes sample INSERTs, UPDATE/DELETE examples, and validation queries.

BEGIN;

INSERT INTO categories (category_id, category_name, parent_category_id) VALUES
  ('cat_women', 'Women', NULL),
  ('cat_tops', 'Tops', 'cat_women'),
  ('cat_dresses', 'Dresses', 'cat_women');

INSERT INTO brands (id, name, slug, logo_url, description, verified, commission_rate, api_enabled, contact_email, whatsapp_number)
VALUES
  ('br_heritage', 'Heritage Loom', 'heritage-loom', 'https://cdn.example.com/brands/heritage.png', 'Contemporary womenswear brand.', TRUE, 12.00, FALSE, 'hello@heritageloom.test', '+923001111111'),
  ('br_nova', 'Nova Stitch', 'nova-stitch', 'https://cdn.example.com/brands/nova.png', 'Minimal essentials and occasion wear.', TRUE, 10.50, FALSE, 'support@novastitch.test', '+923002222222');

INSERT INTO users (id, email, full_name, password, google_id, auth_provider, role, brand_id)
VALUES
  ('usr_admin', 'admin@broady.test', 'Broady Admin', NULL, NULL, 'LOCAL', 'ADMIN', NULL),
  ('usr_ahmed', 'ahmed@example.test', 'Ahmed Raza', 'hashed-password', NULL, 'LOCAL', 'USER', NULL),
  ('usr_sara', 'sara@example.test', 'Sara Khan', 'hashed-password', NULL, 'LOCAL', 'USER', NULL),
  ('usr_heritage_mgr', 'manager@heritageloom.test', 'Hira Manager', NULL, NULL, 'LOCAL', 'BRAND', 'br_heritage'),
  ('usr_nova_mgr', 'manager@novastitch.test', 'Nadia Manager', NULL, NULL, 'LOCAL', 'BRAND', 'br_nova');

INSERT INTO brand_members (id, user_id, brand_id, can_manage_products)
VALUES
  ('bm_001', 'usr_heritage_mgr', 'br_heritage', TRUE),
  ('bm_002', 'usr_nova_mgr', 'br_nova', TRUE);

INSERT INTO product_content_templates (id, type, name, content, brand_id, created_by_id)
VALUES
  ('pct_001', 'DESCRIPTION', 'Hero Description', '{"tone":"premium","length":"short"}', 'br_heritage', 'usr_heritage_mgr'),
  ('pct_002', 'SIZE_GUIDE', 'Standard Size Guide', '{"sizes":["S","M","L"]}', 'br_nova', 'usr_nova_mgr');

INSERT INTO products (id, brand_id, approval_status, name, slug, description, gender, color, type, actual_price, sale_price, discount_percentage, price_pkr, top_category, sub_category, sizes, tags, image_url, stock, is_active)
VALUES
  ('prd_001', 'br_heritage', 'APPROVED', 'Ribbed Cotton Top', 'ribbed-cotton-top', 'Soft ribbed cotton top with a structured fit.', 'WOMEN', 'Ivory', 'Top', 4200.00, 3690.00, 12.14, 3690, 'cat_women', 'cat_tops', ARRAY['S','M','L'], ARRAY['cotton','everyday'], 'https://cdn.example.com/products/prd_001.jpg', 24, TRUE),
  ('prd_002', 'br_heritage', 'APPROVED', 'Embroidered Dress', 'embroidered-dress', 'Lightweight embroidered dress for casual occasions.', 'WOMEN', 'Rose', 'Dress', 6800.00, 6120.00, 10.00, 6120, 'cat_women', 'cat_dresses', ARRAY['S','M'], ARRAY['occasion','embroidered'], 'https://cdn.example.com/products/prd_002.jpg', 12, TRUE),
  ('prd_003', 'br_nova', 'APPROVED', 'Pleated Top', 'pleated-top', 'Modern pleated top with relaxed silhouette.', 'WOMEN', 'Black', 'Top', 3900.00, 3510.00, 10.00, 3510, 'cat_women', 'cat_tops', ARRAY['M','L'], ARRAY['minimal','office'], 'https://cdn.example.com/products/prd_003.jpg', 18, TRUE);

INSERT INTO carts (id, user_id)
VALUES
  ('cart_001', 'usr_ahmed'),
  ('cart_002', 'usr_sara');

INSERT INTO cart_items (id, cart_id, product_id, quantity, selected_color, selected_size)
VALUES
  ('ci_001', 'cart_001', 'prd_001', 2, 'Ivory', 'M'),
  ('ci_002', 'cart_001', 'prd_003', 1, 'Black', 'L'),
  ('ci_003', 'cart_002', 'prd_002', 1, 'Rose', 'S');

INSERT INTO wishlist_items (id, user_id, product_id)
VALUES
  ('wl_001', 'usr_ahmed', 'prd_002'),
  ('wl_002', 'usr_sara', 'prd_001');

INSERT INTO orders (id, user_id, status, payment_method, payment_status, total_pkr, delivery_address, tracking_id)
VALUES
  ('ord_001', 'usr_ahmed', 'CONFIRMED', 'COD', 'PENDING', 10890, 'House 12, Model Town, Lahore', 'TRK-1001'),
  ('ord_002', 'usr_sara', 'PENDING', 'CARD', 'PENDING', 6120, 'A-21, Gulshan, Karachi', NULL);

INSERT INTO sub_orders (id, order_id, brand_id, status, subtotal_pkr, tracking_id)
VALUES
  ('sub_001', 'ord_001', 'br_heritage', 'CONFIRMED', 7380, 'SUB-1001'),
  ('sub_002', 'ord_001', 'br_nova', 'CONFIRMED', 3510, 'SUB-1002'),
  ('sub_003', 'ord_002', 'br_heritage', 'PENDING', 6120, NULL);

INSERT INTO order_items (id, order_id, sub_order_id, product_id, brand_id, quantity, unit_price_pkr, selected_color, selected_size)
VALUES
  ('oi_001', 'ord_001', 'sub_001', 'prd_001', 'br_heritage', 2, 3690, 'Ivory', 'M'),
  ('oi_002', 'ord_001', 'sub_002', 'prd_003', 'br_nova', 1, 3510, 'Black', 'L'),
  ('oi_003', 'ord_002', 'sub_003', 'prd_002', 'br_heritage', 1, 6120, 'Rose', 'S');

INSERT INTO reviews (id, product_id, user_id, brand_id, order_item_id, rating, title, content, status, is_verified_purchase, moderated_by_id)
VALUES
  ('rev_001', 'prd_001', 'usr_ahmed', 'br_heritage', 'oi_001', 5, 'Very comfortable', 'The fabric feels soft and the fit is exact.', 'VISIBLE', TRUE, 'usr_admin');

INSERT INTO review_images (id, review_id, url, sort_order)
VALUES
  ('ri_001', 'rev_001', 'https://cdn.example.com/reviews/rev_001_a.jpg', 0),
  ('ri_002', 'rev_001', 'https://cdn.example.com/reviews/rev_001_b.jpg', 1);

INSERT INTO review_helpfulness_votes (id, review_id, user_id, is_helpful)
VALUES
  ('rhv_001', 'rev_001', 'usr_sara', TRUE);

INSERT INTO review_reports (id, review_id, reported_by_user_id, reason, description, status, resolved_by_id)
VALUES
  ('rr_001', 'rev_001', 'usr_sara', 'SPAM', 'Report created for sample moderation workflow.', 'RESOLVED', 'usr_admin');

INSERT INTO brand_review_replies (id, review_id, brand_id, user_id, content)
VALUES
  ('brr_001', 'rev_001', 'br_heritage', 'usr_heritage_mgr', 'Thank you for the feedback.');

INSERT INTO product_review_aggregates (id, product_id, average_rating, total_reviews, rating1, rating2, rating3, rating4, rating5)
VALUES
  ('pra_001', 'prd_001', 5.00, 1, 0, 0, 0, 0, 1),
  ('pra_002', 'prd_002', 0.00, 0, 0, 0, 0, 0, 0),
  ('pra_003', 'prd_003', 0.00, 0, 0, 0, 0, 0, 0);

INSERT INTO notifications (id, user_id, brand_id, order_id, type, title, message, read_at, channel, delivery_status, delivery_attempts, failed_reason, next_attempt_at)
VALUES
  ('ntf_001', 'usr_ahmed', NULL, 'ord_001', 'ORDER_PLACED', 'Order confirmed', 'Your order has been received and is being prepared.', NULL, 'DASHBOARD', 'DELIVERED', 1, NULL, NULL),
  ('ntf_002', 'usr_heritage_mgr', 'br_heritage', 'ord_001', 'ORDER_PLACED', 'New order to fulfill', 'A new order has been assigned to Heritage Loom.', NULL, 'EMAIL', 'QUEUED', 0, NULL, NULL);

INSERT INTO user_payment_methods (id, user_id, type, label, last4, expires_month, expires_year, is_default)
VALUES
  ('upm_001', 'usr_ahmed', 'CARD', 'Primary Visa', '4242', 12, 2028, TRUE),
  ('upm_002', 'usr_sara', 'JAZZCASH', 'JazzCash Wallet', '8899', NULL, NULL, FALSE);

INSERT INTO notification_preferences (id, user_id, order_updates, promo_emails, security_alerts, wishlist_alerts)
VALUES
  ('np_001', 'usr_ahmed', TRUE, FALSE, TRUE, TRUE),
  ('np_002', 'usr_sara', TRUE, TRUE, TRUE, FALSE),
  ('np_003', 'usr_heritage_mgr', TRUE, FALSE, TRUE, FALSE),
  ('np_004', 'usr_nova_mgr', TRUE, FALSE, TRUE, FALSE);

INSERT INTO user_activities (id, user_id, product_id, event_type, search_query, top_category, sub_category, weight, metadata)
VALUES
  ('ua_001', 'usr_ahmed', 'prd_001', 'VIEW_PRODUCT', NULL, 'cat_women', 'cat_tops', 1.00, '{"source":"homepage"}'),
  ('ua_002', 'usr_ahmed', NULL, 'SEARCH', 'cotton top', 'cat_women', 'cat_tops', 0.75, '{"source":"search"}'),
  ('ua_003', 'usr_sara', 'prd_002', 'ADD_TO_WISHLIST', NULL, 'cat_women', 'cat_dresses', 0.50, '{"source":"wishlist"}');

-- Example update and delete operations required by the assignment.
UPDATE products
SET stock = stock - 1,
    updated_at = NOW()
WHERE id = 'prd_001';

DELETE FROM wishlist_items
WHERE id = 'wl_002';

-- Validation queries.
-- Expected row counts for the generated dataset are shown for reference.
-- categories: 7
-- brands: 6
-- users: 62
-- brand_members: 30
-- products: 60
-- product_content_templates: 44
-- carts: 50
-- cart_items: 100
-- wishlist_items: 50
-- orders: 50
-- sub_orders: 100
-- order_items: 200
-- reviews: 60
-- review_images: 120
-- review_helpfulness_votes: 180
-- review_reports: 50
-- brand_review_replies: 50
-- product_review_aggregates: 60
-- notifications: 90
-- user_payment_methods: 70
-- notification_preferences: 56
-- user_activities: 100
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

SELECT COUNT(*) AS null_brand_ids
FROM users
WHERE brand_id IS NULL;

SELECT o.id AS order_id, oi.id AS order_item_id, p.name AS product_name, b.name AS brand_name
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN brands b ON b.id = oi.brand_id
ORDER BY o.id, oi.id;

SELECT r.id AS review_id, r.rating, p.name AS product_name, u.email AS reviewer_email
FROM reviews r
JOIN products p ON p.id = r.product_id
JOIN users u ON u.id = r.user_id;

COMMIT;