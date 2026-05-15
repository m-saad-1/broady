# Milestone 2 - Normalization Write-Up

This document records the Milestone 2 normalization work for the academic DBLab submission.

## Scope

The goal is to apply formal normalization to the academic marketplace schema while preserving the existing business entities and relationships. The main schema scope includes:

- Users
- Brands
- Categories
- Products
- Orders
- SubOrders
- OrderItems
- Carts
- CartItems
- WishlistItems
- Reviews and review support tables
- Notifications
- Payment methods
- Notification preferences
- User activities

## 1NF — First Normal Form

### Requirement

1NF requires each table to store atomic values and no repeating groups within a single row.

### What changed

- The schema maps each business concept to a dedicated table, so there are no repeating groups stored in a single row for core entities.
- Category metadata was extracted into a separate `categories` table instead of leaving category labels duplicated across the `products` table.
- Repeating associations and lists are represented by child tables where appropriate:
  - `brand_members` for user-brand memberships
  - `cart_items` for cart line items
  - `wishlist_items` for wishlist entries
  - `review_images`, `review_helpfulness_votes`, `review_reports`, and `brand_review_replies` for review-related child records
- `user_activities` was normalized by removing redundant `top_category` and `sub_category` fields; this event log now stores only event-level attributes and references `product_id`.

### Why

This ensures that each row represents a single atomic business fact and that no table contains embedded lists or duplicated attribute groups that belong to an associated entity.

### Justification for the existing attribute design

- `products.sizes` and `products.tags` remain PostgreSQL array attributes in this academic schema. In PostgreSQL these values are stored as atomic array elements, and they are treated as domain-specific variant lists rather than repeating relational rows.
- The core relational design still avoids embedded repeating groups for the tables used in normalization analysis.

## 2NF — Second Normal Form

### Requirement

2NF requires that every non-key attribute depends on the whole primary key and not on only a part of a composite key.

### What changed

- Every table uses a single surrogate primary key or a proper unique composite association, so non-key columns depend on the whole key.
- Junction tables and association tables were kept separate to avoid partial dependency:
  - `brand_members`: membership permissions depend on the pair (`user_id`, `brand_id`)
  - `cart_items`: quantity and selected variant data depend on the cart item row, not only on `cart_id`
  - `wishlist_items`: wishlist entries depend on the unique (`user_id`, `product_id`) relationship
  - `review_helpfulness_votes`: each vote depends on the review and voter pair
  - `brand_review_replies`: reply content depends on the linking review and brand
- `order_items` stores line-level quantity and unit price for the specific item row instead of storing them in `orders`.

### Why

This prevents partial dependency anomalies and ensures each non-key attribute is associated with the full identifying key of its table.

### Confirmation

The schema already satisfied 2NF for most tables once the association tables were separated and surrogate keys were used. That separation was explicitly verified in the normalization review.

## 3NF — Third Normal Form

### Requirement

3NF requires that non-key attributes depend only on the primary key and not on other non-key attributes.

### What changed

- Product category metadata was normalized into the `categories` table, so `products` no longer stores duplicated category label logic by itself.
- Review-related details were moved into dedicated tables instead of mixing them into `reviews`:
  - `review_images`
  - `review_helpfulness_votes`
  - `review_reports`
  - `brand_review_replies`
- `product_review_aggregates` is a separate summary table for derived review metrics.
- `user_activities` was cleaned up so it does not store redundant category labels derived from `product_id`.
- Notification, payment method, and preference tables each store only attributes relevant to their own entity.

### Why

This removes transitive dependencies across tables and avoids update anomalies where a single attribute change could require multiple rows to be updated.

### Confirmation

The revised schema satisfies 3NF because:
- `products` references categories by foreign key rather than duplicating category labels
- review support data exists in child tables, not as additional review columns
- user activity events reference `product_id` and do not duplicate product category state

## Duplicate Removal and Restructuring

### Redundant data removed

- Category labels were centralized in `categories` and referenced by `products`.
- `user_activities` no longer stores `top_category` and `sub_category`, eliminating duplicate category data that could be derived from the referenced product.
- `brand_members` avoids duplicating membership data in both `users` and `brands`.

### Restructuring

- The review domain was restructured so moderation, votes, images, reports, and replies are each stored in their own table.
- The split-order model preserves order-level and brand-level separation in `orders`, `sub_orders`, and `order_items`.

## ERD Update

The normalization changes are reflected in the academic ERD files:

- `Academic_Task/academic-erd.drawio`
- `Academic_Task/academic-erd-simplified.md`

These files now include the normalized `categories` entity and the relationships that support the revised schema.

## Milestone 2 Deliverables

- Formal 1NF/2NF/3NF documentation
- Redundant category storage removed from `user_activities`
- ERD updated to reflect normalized category and association tables
- Schema notes preserved in the academic repository

## Commit Intention

This change set will be committed as:

`M2: Applied 2NF and 3NF normalization, updated ERD and schema`
