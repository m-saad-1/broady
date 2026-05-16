# Milestone 2 - Normalization Write-Up

This document records the Milestone 2 normalization work for the academic DBLab submission.

## Scope

The goal is to keep the marketplace schema normalized without removing important business data or relationships. The normalization focus is the core academic model represented in the ERD:

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

## 1NF

First normal form requires atomic values and no repeating groups.

### Findings

- Product variant data is stored in separate fields such as size and color selections instead of repeating groups.
- Multi-value product sizes are represented as a structured list and should be treated carefully in the academic write-up so the final ERD remains understandable.
- Orders and order items are split so each purchased line item is stored once.

### Result

The schema already follows the core 1NF idea because each table stores one type of entity and each row represents a single record. Where list-like values exist, they are handled as controlled attributes in the app layer or through child tables.

## 2NF

Second normal form requires that non-key attributes depend on the whole key, not part of a composite key.

### Findings

- OrderItems stores item-specific fields such as quantity and unit price that depend on the order-item record, not on the parent order alone.
- CartItems stores the chosen product and quantity for one cart entry, which keeps item-level data attached to the associative entity.
- BrandMembers resolves the many-to-many relationship between users and brands instead of duplicating membership data in either parent table.

### Result

The schema avoids partial dependency problems by separating many-to-many relationships into dedicated junction tables.

## 3NF

Third normal form requires that non-key attributes depend only on the key and not on other non-key attributes.

### Findings

- Product category labels should not remain duplicated across multiple product records as free-form repeated logic in the ERD. The academic model treats Categories as a separate conceptual entity.
- Order-level data stays in Orders, while brand-specific fulfillment data stays in SubOrders.
- Review moderation, voting, images, and reports are split into separate tables so each concern is stored once.

### Result

The normalized design reduces update anomalies and keeps each table focused on a single responsibility.

## Key Normalization Decisions

1. Categories are treated as a conceptual entity for the academic ERD.
2. OrderItems remains the associative table for the order-product relationship.
3. SubOrders preserves the split-order fulfillment pattern instead of merging brand-specific data back into Orders.
4. Review helper tables stay separate to avoid repeating moderation and attachment data inside the main Reviews table.

## Tables That Already Fit Well

These tables are already naturally normalized for the academic scope:

- Users
- Brands
- Carts
- WishlistItems
- ReviewImages
- ReviewHelpfulnessVotes
- ReviewReports
- BrandReviewReplies
- ProductReviewAggregates
- NotificationPreferences

## Milestone 2 Deliverables

- normalization walkthrough from 1NF to 3NF
- updated ERD reference
- schema notes for the academic submission

## Notes For Final Submission

If the instructor asks why the project uses PostgreSQL instead of MySQL, explain that the existing Broady stack already uses PostgreSQL and Prisma, and the academic goal is to preserve the same relationships and constraints.
