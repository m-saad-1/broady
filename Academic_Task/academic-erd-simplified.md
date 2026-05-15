# Complete Important Database Structure for Academic ERD

## Scope
This document provides the complete important business database structure from the Prisma schema for academic ERD work.

Included:
- Business/domain tables needed for marketplace operations.
- Conceptual Categories entity for academic normalization.

Excluded (technical/system tables):
- Session
- OrderStatusLog
- SubOrderStatusLog
- ReviewModerationLog
- NotificationChannelLog
- Migration/internal framework tables
- Token/hash-only technical fields where not needed for ERD understanding

---

## 1) Important Entities Overview

| Academic Entity | Prisma Source | Primary Key | Foreign Keys |
|---|---|---|---|
| Users | User | id | brandId -> Brands.id (nullable ownership link) |
| Brands | Brand | id | None |
| BrandMembers | BrandMember | id | userId -> Users.id, brandId -> Brands.id |
| Categories (Conceptual) | Derived from Product.topCategory/subCategory | categoryId | parentCategoryId -> Categories.categoryId (nullable) |
| Products | Product | id | brandId -> Brands.id, categoryId -> Categories.categoryId (conceptual) |
| ProductContentTemplates | ProductContentTemplate | id | brandId -> Brands.id (nullable), createdById -> Users.id |
| Carts | Cart | id | userId -> Users.id (unique) |
| CartItems | CartItem | id | cartId -> Carts.id, productId -> Products.id |
| WishlistItems | WishlistItem | id | userId -> Users.id, productId -> Products.id |
| Orders | Order | id | userId -> Users.id |
| SubOrders | SubOrder | id | orderId -> Orders.id, brandId -> Brands.id |
| OrderItems | OrderItem | id | orderId -> Orders.id, subOrderId -> SubOrders.id (nullable), productId -> Products.id, brandId -> Brands.id |
| Reviews | Review | id | productId -> Products.id, userId -> Users.id, brandId -> Brands.id, orderItemId -> OrderItems.id (unique), moderatedById -> Users.id (nullable) |
| ReviewImages | ReviewImage | id | reviewId -> Reviews.id |
| ReviewHelpfulnessVotes | ReviewHelpfulnessVote | id | reviewId -> Reviews.id, userId -> Users.id |
| ReviewReports | ReviewReport | id | reviewId -> Reviews.id, reportedByUserId -> Users.id, resolvedById -> Users.id (nullable) |
| BrandReviewReplies | BrandReviewReply | id | reviewId -> Reviews.id (unique), brandId -> Brands.id, userId -> Users.id |
| ProductReviewAggregates | ProductReviewAggregate | id | productId -> Products.id (unique) |
| Notifications | Notification | id | userId -> Users.id (nullable), brandId -> Brands.id (nullable), orderId -> Orders.id (nullable) |
| UserPaymentMethods | UserPaymentMethod | id | userId -> Users.id |
| NotificationPreferences | NotificationPreference | id | userId -> Users.id (unique) |
| UserActivities | UserActivity | id | userId -> Users.id, productId -> Products.id (nullable) |

---

## 2) Table Structures (Important Attributes, Keys)

### Users
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Unique user id |
| email | String | Unique | Login identifier |
| fullName | String | - | User name |
| password | String? | - | Local auth credential |
| googleId | String? | Unique | OAuth identifier |
| authProvider | Enum | - | LOCAL/GOOGLE |
| role | Enum | - | USER/ADMIN/BRAND roles |
| brandId | String? | FK, Unique | Brand ownership link |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### Brands
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Unique brand id |
| name | String | Unique | Brand name |
| slug | String | Unique | URL slug |
| logoUrl | String? | - | Brand logo |
| description | String? | - | Description |
| verified | Boolean | - | Verification state |
| commissionRate | Float | - | Marketplace commission |
| apiEnabled | Boolean | - | API toggle |
| contactEmail | String? | - | Contact email |
| whatsappNumber | String? | - | Contact number |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### BrandMembers
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Membership id |
| userId | String | FK | Member user |
| brandId | String | FK | Member brand |
| canManageProducts | Boolean | - | Permission flag |
| createdAt | DateTime | - | Creation time |

Unique constraints:
- (userId, brandId)

### Categories (Conceptual)
Note: Prisma has no physical Category table; categories are currently in Product.topCategory and Product.subCategory.

| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| categoryId | String | PK | Academic conceptual id |
| categoryName | String | - | Category/subcategory name |
| parentCategoryId | String? | FK | Self-reference for hierarchy |

### Products
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Product id |
| brandId | String | FK | Owner brand |
| approvalStatus | Enum | - | Approval state |
| name | String | - | Product name |
| slug | String | Unique | Product slug |
| description | String | - | Description |
| pricePkr | Int | - | Price |
| topCategory | String | - | Category label |
| subCategory | String | - | Subcategory label |
| sizes | String[] | - | Size list |
| imageUrl | String | - | Primary image |
| stock | Int | - | Inventory |
| isActive | Boolean | - | Active flag |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### ProductContentTemplates
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Template id |
| type | Enum | - | Template type |
| name | String | - | Template name |
| content | Json | - | Template content |
| brandId | String? | FK | Brand-specific template |
| createdById | String | FK | Creator user |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

Unique constraints:
- (name, type, brandId)

### Carts
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Cart id |
| userId | String | FK, Unique | One cart per user |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### CartItems
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Cart item id |
| cartId | String | FK | Parent cart |
| productId | String | FK | Product |
| quantity | Int | - | Quantity |
| selectedColor | String? | - | Variant |
| selectedSize | String? | - | Variant |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

Unique constraints:
- (cartId, productId, selectedColor, selectedSize)

### WishlistItems
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Wishlist row id |
| userId | String | FK | User |
| productId | String | FK | Product |
| createdAt | DateTime | - | Creation time |

Unique constraints:
- (userId, productId)

### Orders
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Order id |
| userId | String | FK | Customer |
| status | Enum | - | Order status |
| paymentMethod | Enum | - | Payment method |
| paymentStatus | Enum | - | Payment status |
| totalPkr | Int | - | Order total |
| deliveryAddress | String | - | Shipping address |
| trackingId | String? | - | Tracking |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### SubOrders
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Sub-order id |
| orderId | String | FK | Parent order |
| brandId | String | FK | Fulfilling brand |
| status | Enum | - | Sub-order status |
| subtotalPkr | Int | - | Brand-level subtotal |
| trackingId | String? | - | Brand shipment tracking |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

Unique constraints:
- (orderId, brandId)

### OrderItems
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Order item id |
| orderId | String | FK | Parent order |
| subOrderId | String? | FK | Parent sub-order |
| productId | String | FK | Purchased product |
| brandId | String | FK | Product brand |
| quantity | Int | - | Ordered quantity |
| unitPricePkr | Int | - | Unit price snapshot |
| selectedColor | String? | - | Variant |
| selectedSize | String? | - | Variant |

### Reviews
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Review id |
| productId | String | FK | Reviewed product |
| userId | String | FK | Reviewer |
| brandId | String | FK | Related brand |
| orderItemId | String | FK, Unique | Verified purchase linkage |
| rating | Int | - | Rating score |
| title | String? | - | Optional title |
| content | String | - | Review text |
| status | Enum | - | Visibility/moderation state |
| isVerifiedPurchase | Boolean | - | Purchase verification |
| moderatedById | String? | FK | Moderator user |
| moderationReason | String? | - | Moderation note |
| moderatedAt | DateTime? | - | Moderation timestamp |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### ReviewImages
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Image id |
| reviewId | String | FK | Parent review |
| url | String | - | Image URL |
| sortOrder | Int | - | Display order |
| createdAt | DateTime | - | Creation time |

### ReviewHelpfulnessVotes
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Vote id |
| reviewId | String | FK | Reviewed review |
| userId | String | FK | Voter |
| isHelpful | Boolean | - | Helpful/not helpful |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

Unique constraints:
- (reviewId, userId)

### ReviewReports
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Report id |
| reviewId | String | FK | Reported review |
| reportedByUserId | String | FK | Reporter |
| reason | Enum | - | Report reason |
| description | String? | - | Report details |
| status | Enum | - | Report status |
| resolutionNote | String? | - | Resolution note |
| resolvedById | String? | FK | Resolver |
| resolvedAt | DateTime? | - | Resolution time |
| createdAt | DateTime | - | Creation time |

### BrandReviewReplies
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Reply id |
| reviewId | String | FK, Unique | One reply per review |
| brandId | String | FK | Replying brand |
| userId | String | FK | Staff user author |
| content | String | - | Reply text |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### ProductReviewAggregates
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Aggregate id |
| productId | String | FK, Unique | Product |
| averageRating | Float | - | Average rating |
| totalReviews | Int | - | Total reviews |
| rating1 | Int | - | Count of 1-star |
| rating2 | Int | - | Count of 2-star |
| rating3 | Int | - | Count of 3-star |
| rating4 | Int | - | Count of 4-star |
| rating5 | Int | - | Count of 5-star |
| updatedAt | DateTime | - | Update time |

### Notifications
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Notification id |
| type | Enum | - | Business notification type |
| title | String | - | Title |
| message | String | - | Message body |
| userId | String? | FK | Target user |
| brandId | String? | FK | Target brand |
| orderId | String? | FK | Related order |
| readAt | DateTime? | - | Read timestamp |
| createdAt | DateTime | - | Creation time |

### UserPaymentMethods
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Payment profile id |
| userId | String | FK | Owner user |
| type | Enum | - | CARD/JAZZCASH/etc. |
| label | String | - | Display label |
| last4 | String | - | Masked identifier |
| expiresMonth | Int? | - | Card month |
| expiresYear | Int? | - | Card year |
| isDefault | Boolean | - | Default payment profile |
| createdAt | DateTime | - | Creation time |
| updatedAt | DateTime | - | Update time |

### NotificationPreferences
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Preference id |
| userId | String | FK, Unique | One row per user |
| orderUpdates | Boolean | - | Order notification toggle |
| promoEmails | Boolean | - | Marketing toggle |
| securityAlerts | Boolean | - | Security toggle |
| wishlistAlerts | Boolean | - | Wishlist toggle |
| updatedAt | DateTime | - | Update time |

### UserActivities
| Attribute | Type | Key Role | Notes |
|---|---|---|---|
| id | String | PK | Activity id |
| userId | String | FK | Actor user |
| productId | String? | FK | Related product |
| eventType | Enum | - | Event type |
| searchQuery | String? | - | Search term |
| topCategory | String? | - | Browsed category |
| subCategory | String? | - | Browsed subcategory |
| weight | Float | - | Activity weight |
| metadata | Json? | - | Additional context |
| createdAt | DateTime | - | Creation time |

---

## 3) Relationship Map

### One-to-Many
| Parent | Child | Relationship | Through FK |
|---|---|---|---|
| Users | Orders | 1:M | Orders.userId |
| Users | UserPaymentMethods | 1:M | UserPaymentMethods.userId |
| Users | Reviews | 1:M | Reviews.userId |
| Users | WishlistItems | 1:M | WishlistItems.userId |
| Users | BrandMembers | 1:M | BrandMembers.userId |
| Users | Notifications | 1:M | Notifications.userId |
| Users | UserActivities | 1:M | UserActivities.userId |
| Users | Cart | 1:1 | Carts.userId (unique) |
| Users | NotificationPreferences | 1:1 | NotificationPreferences.userId (unique) |
| Brands | Products | 1:M | Products.brandId |
| Brands | BrandMembers | 1:M | BrandMembers.brandId |
| Brands | SubOrders | 1:M | SubOrders.brandId |
| Brands | OrderItems | 1:M | OrderItems.brandId |
| Brands | Reviews | 1:M | Reviews.brandId |
| Orders | SubOrders | 1:M | SubOrders.orderId |
| Orders | OrderItems | 1:M | OrderItems.orderId |
| Products | CartItems | 1:M | CartItems.productId |
| Products | WishlistItems | 1:M | WishlistItems.productId |
| Products | OrderItems | 1:M | OrderItems.productId |
| Products | Reviews | 1:M | Reviews.productId |
| Carts | CartItems | 1:M | CartItems.cartId |
| SubOrders | OrderItems | 1:M (optional on item) | OrderItems.subOrderId |
| Reviews | ReviewImages | 1:M | ReviewImages.reviewId |
| Reviews | ReviewHelpfulnessVotes | 1:M | ReviewHelpfulnessVotes.reviewId |
| Reviews | ReviewReports | 1:M | ReviewReports.reviewId |
| Reviews | BrandReviewReplies | 1:1 | BrandReviewReplies.reviewId (unique) |
| Products | ProductReviewAggregates | 1:1 | ProductReviewAggregates.productId (unique) |
| Categories (conceptual) | Products | 1:M | Products.categoryId (conceptual mapping) |

### Many-to-Many (via Associative Tables)
| Entity A | Entity B | M:N Resolved By |
|---|---|---|
| Orders | Products | OrderItems |
| Users | Brands | BrandMembers |
| Users | Products | WishlistItems |
| Users | Products | CartItems (indirect via Carts) |

---

## 4) Key Academic Notes

1. Category is conceptual in ERD.
Prisma stores category values directly in Products (topCategory, subCategory). For academic normalization, model Categories as a separate entity.

2. Split-order pattern is core business logic.
Orders are customer-level transactions; SubOrders are brand-level fulfillment partitions.

3. OrderItems is the major associative entity.
It resolves Orders-Products M:N and also binds brand/sub-order fulfillment context.

4. Review domain enforces purchase linkage.
Reviews.orderItemId is unique, which supports one review per purchased line item.

5. Technical/system logging excluded.
Status logs and channel logs are intentionally excluded from the ERD core per task requirement.

---

## 5) Minimal Core ERD (If Instructor Asks for Short Version)

Use these essential tables only:
- Users
- Brands
- Categories (conceptual)
- Products
- Orders
- SubOrders
- OrderItems

Then optionally add:
- BrandMembers, Carts, CartItems, WishlistItems, Reviews