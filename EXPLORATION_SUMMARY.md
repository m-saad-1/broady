# Broady Codebase Exploration Summary
**Date:** April 19, 2026

---

## 1. BRAND ORDERS IMPLEMENTATION

### Current Filter Implementation (in `orders-client.tsx`)

**Filter Options:**
```
- ALL (default for full orders page)
- PENDING
- CONFIRMED  
- SHIPPED (includes PARTIALLY_SHIPPED status)
```

**Filter Logic:**
- Filter buttons are static, shown as a horizontal button row
- Active filter state: `activeFilter: OrderFilter`
- Matching logic in `matchesFilter()` function handles SHIPPED treating both "SHIPPED" and "PARTIALLY_SHIPPED" as equivalent
- Filtered orders sorted by: priority (DELIVERED/CANCELED last) then by creation date (newest first)

**Displayed Order Information per Card:**
- Order ID (truncated first 10 chars)
- Customer name & email
- Order creation date/time (formatted)
- Current status badge
- Payment method & payment status
- Tracking ID (or "Not assigned")
- Delivery address (truncated)
- Last status log entry with timestamp
- Product names (comma-separated list)

### Order Detail Component (`brand-order-detail-client.tsx`)

**Editable Fields:**
- Status (select dropdown with available status options)
- Tracking ID (text input)
- Note (text field for brand internal note)
- Customer Note (text field for customer-facing note)

**Image Handling:**
- Product images displayed in order details
- Uses `ProductImage` component with fallback to `/window.svg`
- Images are stored as URLs in product records

### Dashboard vs. Full Orders Page
- **Dashboard Mode:** Shows only PENDING orders by default, with product panels for "Top by Stock" and "Recently Updated"
- **Orders Page Mode:** Shows ALL orders by default, no product panels

---

## 2. PRODUCT COMPONENTS IMPLEMENTATION

### Brand Product List (`brand-products-list-client.tsx`)

**Product Card Display Fields:**
- Product name (linked to `/product/{slug}`)
- Product image (96px square)
- Top category / Sub category
- Approval status badge (PENDING/APPROVED/REJECTED/DRAFT with color coding)
- Description (line-clamped to 3 lines)
- Price (PKR, formatted with no decimals)
- Stock count
- Active status (Yes/No)
- Sizes (comma-separated list)

**Summary Statistics:**
- Total products count
- Active products count
- Pending approvals count

**Image Handling:**
- 24x24 pixel product images in list
- Uses `ProductImage` component
- Falls back to `/window.svg` if no image

### Product Creation Form (`brand-product-create-client.tsx`)

**Form Fields (in order of appearance):**

**Basic Information:**
1. Product name (required, min 2 chars)
2. Slug (required, min 2 chars)
3. Description (required, min 10 chars, textarea)
4. Price PKR (required, number, min 1)
5. Stock (required, number, min 0)
6. Top Category (select: Men/Women/Kids)
7. Sub category (required, text)
8. Sizes (required, comma-separated string, default "S, M, L")
9. Image URL (required, must be absolute http(s) or root-relative path)

**Size Guide Section:**
10. Size guide image URL (optional, absolute http(s) or root-relative)
11. Delivery time (optional text)

**Delivery & Returns Section:**
12. Return policy (textarea)
13. Refund conditions (textarea)

**Shipping Section:**
14. Shipping regions (textarea, default "Pakistan")
15. Shipping estimated delivery time (default "3-5 business days")
16. Shipping charges (optional text)

**Fabric Care Section:**
17. Fabric type (optional text, default "Cotton")
18. Care instructions (textarea, default "Machine wash cold, do not bleach")

**Activation:**
19. Is Active checkbox (defaults to true)

**Submit Behavior:**
- Validation via `buildBrandProductPayload()` helper
- Calls `submitBrandProduct()` API endpoint
- Resets form to defaults on successful submission
- Shows success toast: "Product submitted for approval"

### Catalog Product Display (`catalog-client.tsx`)

**Product Card in Catalog Grid (via `ProductCard` component):**
- Product image (aspect 4:5)
- Badge (discount %, "Sale", "New", "Limited", or "Out of Stock")
- Brand name
- Product name
- Price (with discount stripe if applicable)
- Top category / Product type / Sub category
- Stock status
- Add to cart button
- Wishlist toggle button

### Catalog Filtering

**Available Filters:**
- Gender (Top Category): Men/Women/Kids
- Product Type (derived from products in selection)
- Sub Category (cascading, depends on top category & type)
- Size (cascading, depends on all above)

**Filter Logic:**
- Filters cascade - each selection narrows options for next filter
- Invalid selections reset to empty
- Search query parameter integration
- Sort options: Latest (default), Price Low-High, Price High-Low, Name A-Z

**URL Parameter Structure:**
- `q` - search query
- `topCategory` - Men/Women/Kids
- `productType` - product type
- `subCategory` - sub category
- `size` - single size
- `sortBy` - sort option

---

## 3. REVIEW COMPONENTS IMPLEMENTATION

### Brand Reviews (`reviews-client.tsx`)

**Review Card Display:**
- Product image (16x16px thumbnail)
- Product name (linked)
- Rating (as badge: "5/5")
- Review status
- Customer name
- Brand name
- Review title/content (collapsible)
- Reply interface (form to add brand response)

**Features:**
- Pagination (50 items loaded)
- Reply submission form for brand responses
- Link to "Open product reviews" (to product all-reviews page)

**Image Handling:**
- Small review product thumbnails
- Falls back to `/window.svg`

### Product All-Reviews Page (`product/[slug]/reviews/page.tsx`)

**Header:**
- Product name
- Back to product link
- Total review count

**Review Section Features (via `ReviewSection` component):**
- Review sorting options: Newest, Rating, Helpful
- Rating filter (1-5 stars)
- Load more pagination
- Individual review cards with:
  - Star rating display
  - Review content
  - Review images (if any)
  - Helpful voting
  - Report review option
- Review write form (for purchased customers):
  - Star rating selector
  - Review content textarea
  - Image upload (multiple)
  - Submit button

**Review Write Eligibility:**
- User must be logged in
- Must have purchased the product (DELIVERED order status)
- Can only write one review per order item
- First unreviewed product item from a delivered order is selected

### Product Detail Page Review Section

**Review Summary Display:**
- Average rating
- Total review count
- Rating distribution (1-5 stars count)
- Preview of top 3 helpful reviews
- "View all reviews" link (for showing page with more reviews)

---

## 4. API CLIENT IMPLEMENTATION

### Authentication & Transport
- Uses `authFetch()` for authenticated requests (includes Bearer token header)
- Uses `safeFetch()` for public requests
- Both functions handle timeouts (8 seconds), errors, and error responses
- Envelope pattern: `{ data: T }` for successful responses
- Error handling extracts message and code from response body

### Brand Order Endpoints

```typescript
// Get all brand orders for authenticated user's brand
getBrandDashboardOrders(status?: string): Promise<BrandDashboardOrder[]>

// Get single order detail
getBrandDashboardOrder(orderId: string): Promise<BrandDashboardOrder>

// Update order status
updateBrandOrderStatus(orderId: string, payload: {
  status: string
  trackingId?: string
  note?: string
  customerNote?: string
}): Promise<BrandDashboardOrder>
```

### Product Endpoints

```typescript
// Get catalog products with filtering
getProducts(params?: Record<string, string>): Promise<Product[]>

// Get single product by slug
getProduct(slug: string): Promise<Product | null>

// Get brand dashboard products (authenticated)
getBrandDashboardProducts(): Promise<Product[]>

// Submit new brand product (goes to approval)
submitBrandProduct(payload: Omit<ProductMutationPayload, "brandId">): Promise<Product>

// Update existing brand product
updateBrandDashboardProduct(productId: string, payload: Partial<ProductUpdate>): Promise<Product>

// Admin: Create product for any brand
createProduct(payload: ProductMutationPayload): Promise<Product>

// Admin: Get all products
getAdminProducts(): Promise<Product[]>

// Admin: Approve/reject product
approveProduct(productId: string, note?: string): Promise<Product>
rejectProduct(productId: string, note?: string): Promise<Product>
```

### Review Endpoints

```typescript
// Get reviews for a product
getProductReviews(productId: string, options?: {
  limit?: number
  skip?: number
  sort?: "newest" | "rating" | "helpful"
  rating?: number
}): Promise<ProductReviewsResponse>

// Get authenticated user's reviews
getMyReviews(limit: number, skip: number): Promise<ProductReview[]>

// Brand: Get reviews for their products
getBrandReviews(limit: number, skip: number): Promise<ProductReview[]>

// Submit review
submitReview(payload: ReviewMutationPayload): Promise<ProductReview>

// Vote review helpful
voteReviewHelpfulness(reviewId: string, helpful: boolean): Promise<void>

// Report review
reportReview(reviewId: string, reason: ReviewReportReason, description?: string): Promise<void>

// Brand: Reply to review
replyToReview(reviewId: string, content: string): Promise<void>

// Upload review images
uploadReviewImages(files: File[]): Promise<string[]>
```

### Response Normalization

**BrandDashboardOrder Normalization:**
- Handles nested order objects
- Defaults missing fields (paymentMethod, paymentStatus, totalPkr, etc.)
- Resolves user information from nested or top-level fields
- Normalizes status logs array

**Product Normalization:**
- Applies taxonomy normalization via `normalizeProduct()`
- Converts fields to expected types
- Handles optional fields

---

## 5. IMAGE HANDLING & STORAGE

### Current Image Storage Pattern
- **Images are stored as URLs**, not file uploads for products
- URLs are stored in database fields: `imageUrl`, `sizeGuideImageUrl`
- URLs must be either:
  - Absolute HTTP(S) URLs (e.g., `https://cdn.example.com/image.jpg`)
  - Root-relative asset paths (e.g., `/images/product.jpg`)

### Storage Provider Configuration
- Storage provider can be: `cloudinary` or `s3` (configured via env)
- Public asset URLs are constructed via `getPublicAssetUrl(path, cdnBase)`
- Falls back to `window.svg` if image URL is missing or invalid

### Review Image Upload
- Reviews support image URLs array: `imageUrls?: string[]`
- Upload endpoint: `POST /reviews/uploads`
- Accepts multipart form data (multiple files)
- Returns array of uploaded image URLs

### Validation
- Image URLs validated as absolute http(s) or root-relative paths
- Invalid URLs rejected during product creation/update
- Zod validation in `product-form.ts`:
  ```
  isProductAssetUrl(value: string) {
    if (value.startsWith("/")) return true
    try {
      const url = new URL(value)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch { return false }
  }
  ```

---

## 6. FORM VALIDATION & PAYLOAD BUILDING

### Product Form Validation (`product-form.ts`)

**Zod Schema Validation:**
- Strict min length requirements on all text fields
- Pricing: positive integer PKR values only
- Top category enum: ["Men", "Women", "Kids"]
- Sizes parsed from comma-separated string to array
- Image URLs validated as absolute or root-relative
- Template IDs treated as optional (empty string → undefined)
- Size guide rows require all fields (size, cm, inches)

**Helper Functions:**
- `buildAdminProductPayload()` - includes brandId, full validation
- `buildBrandProductPayload()` - excludes brandId, brand context implicit
- Both parse form values and return `ProductMutationPayload` type

**Payload Structure:**
```typescript
type ProductMutationPayload = {
  brandId: string  // admin only
  name: string
  slug: string
  description: string
  pricePkr: number
  topCategory: "Men" | "Women" | "Kids"
  subCategory: string
  sizes: string[]  // parsed from CSV
  imageUrl: string
  sizeGuideTemplateId?: string
  sizeGuide: ProductSizeGuide  // built from form rows
  deliveriesReturnsTemplateId?: string
  deliveriesReturns: ProductDeliveriesReturns  // built from form fields
  shippingDeliveryTemplateId?: string
  shippingDelivery: ProductShippingDelivery
  fabricCareTemplateId?: string
  fabricCare: ProductFabricCare
  stock: number
  isActive?: boolean
}
```

### Review Submission Payload
```typescript
type ReviewMutationPayload = {
  orderItemId: string  // from user's delivered order
  rating: number  // 1-5
  content: string  // review text
  imageUrls?: string[]  // uploaded image URLs
}
```

---

## 7. COMPONENT ARCHITECTURE

### Shared UI Components
- `ProductImage` - Next.js Image with fallback
- `ProductCard` - Reusable product display card
- `ReviewSection` - Reusable reviews component with filtering
- `Button` - Styled button component
- `Card` - Base card wrapper
- `ConfirmModal` - Confirmation dialogs

### Client vs. Server Separation
- Pages use server components with `await getBrandSession()`
- Client components handle state, filtering, form submission
- Split: server loads initial data, client handles interactions

### State Management
- Zustand stores for: auth, cart, wishlist, toast notifications
- Local component state for forms, filters, UI visibility
- TanStack Query for product list pagination/filtering

---

## 8. CURRENT LIMITATIONS & PATTERNS

### No Built-in Filtering for Brand Orders
- Brand orders filter only by status
- No date range, customer name, amount range filtering

### Image URLs Only
- No file upload UI for product images
- URLs must be manually provided or managed elsewhere
- Cloudinary/S3 integration happens server-side

### Template System
- Product details (size guide, delivery, shipping, fabric care) use optional templates
- Templates can be selected or inline content provided
- Flexible but requires coordination

### Review Filtering
- Only rating and sort available
- No date range or helpful count threshold filtering
- Search within reviews not implemented

### Catalog Filtering Limitations
- Only cascading select filters (no multi-select)
- No price range filtering (available in API params but not UI)
- No brand filter in UI (available in API)

### Product Status
- Approval workflow: DRAFT → PENDING → APPROVED/REJECTED
- Only brand-submitted products need approval
- Admin-created products bypass approval

---

## 9. KEY DATA TYPES

### BrandDashboardOrder
```typescript
{
  id: string
  status: OrderStatus  // PENDING, CONFIRMED, SHIPPED, etc.
  paymentMethod: string  // COD, JAZZCASH, EASYPAISA
  paymentStatus: string  // PENDING, COMPLETED, FAILED
  totalPkr: number
  deliveryAddress: string
  createdAt: string  // ISO datetime
  updatedAt: string  // ISO datetime
  user: { id, fullName, email }
  items: Array<{ product, quantity, selectedSize?, selectedColor? }>
  statusLogs: Array<{ status, createdAt }>
  trackingId?: string
}
```

### Product
```typescript
{
  id: string
  name: string
  slug: string
  description: string
  pricePkr: number
  topCategory: "Men" | "Women" | "Kids"
  subCategory: string
  sizes: string[]
  imageUrl: string
  stock: number
  isActive: boolean
  approvalStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
  brand: { id, name, slug }
  sizeGuide?: ProductSizeGuide
  deliveriesReturns?: ProductDeliveriesReturns
  shippingDelivery?: ProductShippingDelivery
  fabricCare?: ProductFabricCare
  createdAt: string
  updatedAt: string
}
```

### ProductReview
```typescript
{
  id: string
  productId: string
  product: Product
  user: { id, fullName }
  rating: number  // 1-5
  content: string
  imageUrls?: string[]
  helpfulCount: number
  reportCount: number
  status: "PUBLISHED" | "PENDING" | "REJECTED"
  brandReply?: { content, createdAt }
  createdAt: string
  updatedAt: string
}
```

---

## 10. NEXT STEPS FOR IMPLEMENTATION

Based on this exploration, the following features are ready for implementation:

1. **Brand Order Filters Enhancement** - Add date range, customer search, amount range
2. **Product Management Enhancements** - Bulk actions, advanced filtering, status management
3. **Review Management** - More filtering options, moderation tools
4. **Image Upload Integration** - Direct file upload UI for products
5. **Advanced Catalog Filtering** - Price ranges, multi-select, brand filtering
6. **Analytics & Reporting** - Order trends, bestsellers, review analytics

