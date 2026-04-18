Brand Dashboard – Modifications & Fixes
1. Order Filters (Dashboard + All Orders Page)
Add filters:
New
Delivered
Cancelled
Apply in:
Main Dashboard (Orders section)
All Orders page
2. Product Form (Revert Fields)
In Product Adding Page, restore previous fields and structure:
Size & Size Guide
Shipping & Delivery
Returns & Exchange
Fabric & Care
Revert to the old implementation approach (remove new structured/template system if applied)
3. All Products Page Updates
Remove description from product cards
Add:
Orders count
Reviews count
Add Edit button:
Redirects to Product Adding Page
Pre-fill form with existing product data
4. Orders Page UI Fix
Improve order items card layout:
Avoid cramped/contracted design
Add proper spacing and hierarchy
Make UI feel open and readable
5. Reviews Page (Brand Dashboard)
Remove brand name from user review display
On clicking:
Image or title → redirect to Order Details page
In Brand Reply Card:
Remove text:
❌ “Visible to customers on the product review page”
6. Product – All Reviews Page Fixes
Display Enhancements
Show product details with each review:
Color
Size
Rating Distribution Fix
Fix rating indicator (pipe/bar):
If multiple ratings have same count → bars should be equal length
Ensure visually accurate ratio (no half/incorrect fills)
Apply fix in:
Product All Reviews page
Product Details page (reviews section)
Image Loading Bug (Critical)
Fix issue where uploaded images (from gallery/folder) are not loading
Ensure:
Proper storage (URL/path handling)
Correct rendering in review UI
Expected Outcome
Cleaner product and order UI
Correct and consistent review display
Fully functional product editing flow
Accurate rating visualization and image handling