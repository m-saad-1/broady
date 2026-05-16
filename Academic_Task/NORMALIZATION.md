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

## 1NF (First Normal Form)

First normal form requires that every table contains atomic values, meaning there are no repeating groups or arrays embedded directly inside the table rows.

### Findings

- **Product Variants:** Instead of storing multiple variant details in a single repeating string (e.g., "Color: Red, Blue, Green"), variant data is managed through distinct fields (`color`, `type`) and arrays. While arrays (`sizes`) technically break strict 1NF in pure relational theory, PostgreSQL supports array types natively. However, for the academic ERD, we conceptualize variant structures clearly so they do not manifest as repeating groups.
- **Line Items:** A single order can contain multiple products. To comply with 1NF, we cannot store a list of product IDs inside the `Orders` table.

### Result

The schema satisfies 1NF by ensuring that core entities (Users, Brands, Products, Orders) store discrete attributes. The `Orders` to `Products` relationship is resolved by extracting repeating product groups into a dedicated `OrderItems` table.

## 2NF (Second Normal Form)

Second normal form requires compliance with 1NF and that every non-key attribute fully depends on the entire primary key, not just a part of a composite key.

### Findings

- **Order Tracking:** Information like `quantity` and `unitPrice` depends specifically on the unique combination of an Order and a Product. Storing `unitPrice` on the `Orders` table would cause a partial dependency.
- **Cart Management:** Similarly, the `CartItems` table holds the user's specific product selections (including `selectedColor` and `selectedSize`) linking the `Cart` to the `Product`.
- **User-Brand Affiliations:** `BrandMembers` utilizes a composite-like understanding (User + Brand) to store permissions (`canManageProducts`).

### Result

The schema satisfies 2NF by isolating many-to-many relationships into dedicated associative junction tables (`OrderItems`, `CartItems`, `BrandMembers`). Non-key attributes in these tables are fully dependent on the associative primary key (or composite keys where conceptualized).

## 3NF (Third Normal Form)

Third normal form requires compliance with 2NF and that no transitive dependencies exist. A non-key attribute must not depend on another non-key attribute.

### Findings

- **Categories:** Product categories (`topCategory`, `subCategory`) conceptually represent separate entities. Leaving them as free-text fields in the `Products` table risks update anomalies (e.g., renaming a category requires updating every product row). We extract them into a distinct `Categories` entity for the academic ERD.
- **Fulfillment Separation:** Storing brand-specific tracking and sub-total amounts directly on the `Orders` table creates transitive dependencies, as these values depend on the fulfilling Brand, not just the overarching Order. We resolve this by introducing the `SubOrders` table.
- **Review Moderation:** Keeping moderation details and attached images directly within the `Reviews` table risks bloat and anomalies. These are split into `ReviewImages` and `ReviewReports`.

### Result

The schema satisfies 3NF. Transitive dependencies are removed. Each table focuses entirely on a single logical entity or relationship, drastically minimizing data redundancy and preventing modification anomalies.

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
