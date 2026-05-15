-- Milestone 4 - PostgreSQL DDL for the academic Broady DBLab schema
-- Core scope only: normalized marketplace tables used in the academic ERD.

BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  category_id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL,
  parent_category_id TEXT NULL,
  CONSTRAINT fk_categories_parent
    FOREIGN KEY (parent_category_id)
    REFERENCES categories(category_id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 12,
  api_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contact_email TEXT,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password TEXT,
  google_id TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'LOCAL' CHECK (auth_provider IN ('LOCAL', 'GOOGLE')),
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'BRAND', 'SUPER_ADMIN')),
  brand_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_users_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brand_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  can_manage_products BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_brand_members_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_brand_members_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_brand_members UNIQUE (user_id, brand_id)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'WOMEN',
  color TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL DEFAULT 'Top',
  actual_price NUMERIC(12,2) NOT NULL,
  sale_price NUMERIC(12,2),
  discount_percentage NUMERIC(5,2),
  price_pkr INTEGER NOT NULL,
  top_category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  sizes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  image_url TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_products_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_products_category
    FOREIGN KEY (top_category)
    REFERENCES categories(category_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_products_sub_category
    FOREIGN KEY (sub_category)
    REFERENCES categories(category_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS product_content_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  brand_id TEXT,
  created_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_templates_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_templates_user
    FOREIGN KEY (created_by_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_templates UNIQUE (name, type, brand_id)
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_carts_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  selected_color TEXT,
  selected_size TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_cart_items_cart
    FOREIGN KEY (cart_id)
    REFERENCES carts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_cart_items UNIQUE (cart_id, product_id, selected_color, selected_size)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_wishlist_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_wishlist UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'REFUNDED')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'CARD', 'JAZZCASH', 'BANK_TRANSFER')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  total_pkr INTEGER NOT NULL CHECK (total_pkr >= 0),
  delivery_address TEXT NOT NULL,
  tracking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sub_orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'REFUNDED')),
  subtotal_pkr INTEGER NOT NULL CHECK (subtotal_pkr >= 0),
  tracking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sub_orders_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sub_orders_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_sub_orders UNIQUE (order_id, brand_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sub_order_id TEXT,
  product_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_pkr INTEGER NOT NULL CHECK (unit_price_pkr >= 0),
  selected_color TEXT,
  selected_size TEXT,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_sub_order
    FOREIGN KEY (sub_order_id)
    REFERENCES sub_orders(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  order_item_id TEXT NOT NULL UNIQUE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VISIBLE' CHECK (status IN ('VISIBLE', 'HIDDEN', 'PENDING', 'REMOVED')),
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  moderated_by_id TEXT,
  moderation_reason TEXT,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_reviews_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reviews_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reviews_order_item
    FOREIGN KEY (order_item_id)
    REFERENCES order_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reviews_moderated_by
    FOREIGN KEY (moderated_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS review_images (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_review_images_review
    FOREIGN KEY (review_id)
    REFERENCES reviews(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_helpfulness_votes (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_review_votes_review
    FOREIGN KEY (review_id)
    REFERENCES reviews(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_votes_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_review_votes UNIQUE (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS review_reports (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  reported_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  resolution_note TEXT,
  resolved_by_id TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_review_reports_review
    FOREIGN KEY (review_id)
    REFERENCES reviews(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_reports_user
    FOREIGN KEY (reported_by_user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_reports_resolver
    FOREIGN KEY (resolved_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brand_review_replies (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL UNIQUE,
  brand_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_review_replies_review
    FOREIGN KEY (review_id)
    REFERENCES reviews(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_replies_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_replies_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_review_aggregates (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE,
  average_rating NUMERIC(4,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  rating1 INTEGER NOT NULL DEFAULT 0,
  rating2 INTEGER NOT NULL DEFAULT 0,
  rating3 INTEGER NOT NULL DEFAULT 0,
  rating4 INTEGER NOT NULL DEFAULT 0,
  rating5 INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_review_aggregates_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brand_id TEXT,
  order_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  channel TEXT NOT NULL DEFAULT 'DASHBOARD' CHECK (channel IN ('DASHBOARD', 'EMAIL', 'PUSH', 'SMS')),
  delivery_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (delivery_status IN ('QUEUED', 'SENT', 'FAILED', 'DELIVERED')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  failed_reason TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  last4 TEXT NOT NULL,
  expires_month INTEGER,
  expires_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payment_methods_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  order_updates BOOLEAN NOT NULL DEFAULT TRUE,
  promo_emails BOOLEAN NOT NULL DEFAULT FALSE,
  security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  wishlist_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_notification_preferences_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT,
  event_type TEXT NOT NULL,
  search_query TEXT,
  top_category TEXT,
  sub_category TEXT,
  weight NUMERIC(8,2) NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_user_activities_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_activities_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_brand_members_brand_id ON brand_members (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_category ON products (brand_id, top_category, sub_category);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (top_category, sub_category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price_pkr);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_product ON wishlist_items (user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_brand_status ON sub_orders (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_order_created ON sub_orders (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_brand_order ON order_items (brand_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sub_order ON order_items (sub_order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_status_created ON reviews (product_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_brand_status_created ON reviews (brand_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_review_images_review_sort ON review_images (review_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_helpfulness_votes (review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_review_status ON review_reports (review_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_review_reports_reporter ON review_reports (reported_by_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_brand_review_replies_brand_created ON brand_review_replies (brand_id, created_at);
CREATE INDEX IF NOT EXISTS idx_product_review_aggregates_product ON product_review_aggregates (product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_brand_created ON notifications (brand_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_created ON user_payment_methods (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_created ON user_activities (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_event_created ON user_activities (user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_product_event_created ON user_activities (product_id, event_type, created_at);

COMMIT;