import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
import random

OUTPUT_DIR = Path(__file__).resolve().parent / "csv"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def write_csv(name, headers, rows):
    path = OUTPUT_DIR / name
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"Wrote {path} ({len(rows)} rows)")

now = datetime(2026, 5, 15, 0, 0)

# 1. Categories (Increase to 50+)
categories = [
    ("cat_women", "Women", ""),
    ("cat_men", "Men", ""),
    ("cat_kids", "Kids", ""),
    ("cat_home", "Home & Living", ""),
    ("cat_accessories", "Accessories", ""),
]
# Generate subcategories to reach 50+
for i in range(1, 10):
    categories.append((f"cat_women_{i}", f"Women Sub {i}", "cat_women"))
    categories.append((f"cat_men_{i}", f"Men Sub {i}", "cat_men"))
    categories.append((f"cat_kids_{i}", f"Kids Sub {i}", "cat_kids"))
    categories.append((f"cat_home_{i}", f"Home Sub {i}", "cat_home"))
    categories.append((f"cat_acc_{i}", f"Acc Sub {i}", "cat_accessories"))

# 2. Brands (Increase to 50+)
brands = []
for i in range(1, 51):
    brand_id = f"br_{i:03d}"
    name = f"Brand {i} Atelier"
    slug = f"brand-{i}-atelier"
    brands.append((
        brand_id, name, slug, 
        f"https://cdn.example.com/brands/br_{i:03d}.png",
        f"Description for {name}.", 
        "true", 
        f"{10.0 + (i % 5):.2f}", 
        "false", 
        f"contact@brand{i}.test", 
        f"+92300{i:07d}", 
        now.isoformat() + "Z", 
        now.isoformat() + "Z"
    ))

# 3. Users (Increase to 100+)
users = [
    ("usr_admin", "admin@broady.test", "Broady Admin", "hashed_pwd", "", "LOCAL", "ADMIN", "", now.isoformat() + "Z", now.isoformat() + "Z"),
]
# Add brand managers
for i in range(1, 51):
    users.append((
        f"usr_mgr_{i:03d}", 
        f"manager{i}@brand{i}.test", 
        f"Manager {i}", 
        "hashed_pwd", 
        "", 
        "LOCAL", 
        "BRAND", 
        f"br_{i:03d}", 
        now.isoformat() + "Z", 
        now.isoformat() + "Z"
    ))
# Add regular users
for i in range(1, 101):
    users.append((
        f"usr_{i:03d}",
        f"user{i}@example.test",
        f"User {i}",
        "hashed_pwd",
        "",
        "LOCAL",
        "USER",
        "",
        now.isoformat() + "Z",
        now.isoformat() + "Z",
    ))

# 4. Brand Members (Increase to 50+)
brand_members = []
for i in range(1, 51):
    brand_members.append((
        f"bm_{i:03d}", 
        f"usr_mgr_{i:03d}", 
        f"br_{i:03d}", 
        "true", 
        now.isoformat() + "Z"
    ))

# 5. Product Content Templates (Increase to 100+)
templates = []
for i in range(1, 101):
    brand_id = f"br_{(i % 50) or 50:03d}"
    templates.append((
        f"pct_{i:03d}",
        "DESCRIPTION" if i % 2 == 1 else "SIZE_GUIDE",
        f"Template {i}",
        json.dumps({"tone": "premium", "length": "short"} if i % 2 == 1 else {"sizes": ["S", "M", "L"]}),
        brand_id,
        "usr_admin",
        now.isoformat() + "Z",
        now.isoformat() + "Z",
    ))

# 6. Products (Increase to 100+)
product_rows = []
for i in range(1, 101):
    brand_id = f"br_{(i % 50) or 50:03d}"
    cat = categories[i % 5][0] # Top cat
    subcat = categories[5 + (i % 45)][0] # Sub cat
    name = f"Product {i}"
    product_rows.append((
        f"prd_{i:03d}",
        brand_id,
        "APPROVED",
        name,
        name.lower().replace(" ", "-"),
        f"Detailed description for {name}.",
        "WOMEN" if i % 2 == 0 else "MEN",
        ["Black", "White", "Red", "Navy", "Green"][i % 5],
        ["Top", "Dress", "Knitwear", "Accessory", "Bottom"][i % 5],
        5000.00 + i * 20,
        4500.00 + i * 20,
        10.0,
        4500 + i * 20,
        cat,
        subcat,
        json.dumps(["S", "M", "L"]),
        json.dumps(["new", "featured"]),
        f"https://cdn.example.com/products/prd_{i:03d}.jpg",
        50 + i,
        "true",
        now.isoformat() + "Z",
        now.isoformat() + "Z",
    ))

# 7. Carts & Cart Items (Increase to 100+)
carts = []
cart_items = []
wishlist = []
for i in range(1, 101):
    user_id = f"usr_{i:03d}"
    carts.append((f"cart_{i:03d}", user_id, now.isoformat() + "Z", now.isoformat() + "Z"))
    for j in range(1, 3):
        product_id = f"prd_{( (i*j) % 100) or 100:03d}"
        cart_items.append((f"ci_{i:03d}_{j}", f"cart_{i:03d}", product_id, j, "Black", "M", now.isoformat() + "Z", now.isoformat() + "Z"))
    wishlist.append((f"wl_{i:03d}", user_id, f"prd_{(i % 100) or 100:03d}", now.isoformat() + "Z"))

# 8. Orders & SubOrders & OrderItems (Increase to 100+)
orders = []
sub_orders = []
order_items = []
for i in range(1, 101):
    user_id = f"usr_{i:03d}"
    order_id = f"ord_{i:03d}"
    orders.append((order_id, user_id, "CONFIRMED", "COD", "PENDING", 8000 + i * 10, f"Street {i}, City", f"TRK-{2000+i}", now.isoformat() + "Z", now.isoformat() + "Z"))
    
    # 2 brands per order
    brand_ids = [f"br_{(i % 50) or 50:03d}", f"br_{((i+1) % 50) or 50:03d}"]
    for bidx, brand_id in enumerate(brand_ids, start=1):
        sub_id = f"sub_{i:03d}_{bidx}"
        sub_orders.append((sub_id, order_id, brand_id, "CONFIRMED", 4000 + i * 5, f"SUB-{2000 + i * 10 + bidx}", now.isoformat() + "Z", now.isoformat() + "Z"))
        
        # 2 items per sub-order
        for item_idx in range(1, 3):
            prod_id = f"prd_{((i+bidx+item_idx) % 100) or 100:03d}"
            order_items.append((f"oi_{i:03d}_{bidx}_{item_idx}", order_id, sub_id, prod_id, brand_id, 1, 2000 + i, "Black", "M"))

# 9. Reviews & related (Increase to 100+)
reviews = []
review_images = []
review_votes = []
review_reports = []
brand_replies = []
review_aggregates = []
for i in range(1, 101):
    product_id = f"prd_{i:03d}"
    user_id = f"usr_{((i + 10) % 100) or 100:03d}"
    brand_id = f"br_{(i % 50) or 50:03d}"
    order_item_id = f"oi_{( (i%100) or 100):03d}_1_1"
    review_id = f"rev_{i:03d}"
    reviews.append((review_id, product_id, user_id, brand_id, order_item_id, (i % 5) + 1, f"Review {i}", f"Excellent quality product {i}.", "VISIBLE", "true", "usr_admin", "", "", now.isoformat() + "Z", now.isoformat() + "Z"))
    review_images.append((f"ri_{i:03d}", review_id, f"https://cdn.example.com/reviews/img_{i:03d}.jpg", 0, now.isoformat() + "Z"))
    review_votes.append((f"rv_{i:03d}", review_id, f"usr_{((i+1) % 100) or 100:03d}", "true", now.isoformat() + "Z", now.isoformat() + "Z"))
    if i % 2 == 0:
        review_reports.append((f"rr_{i:03d}", review_id, f"usr_{((i+2) % 100) or 100:03d}", "SPAM", "Bot review", "RESOLVED", "Fixed", "usr_admin", now.isoformat() + "Z"))
    if i % 2 == 0:
        brand_replies.append((f"brr_{i:03d}", review_id, brand_id, f"usr_mgr_{(i%50) or 50:03d}", "Thanks for your feedback!", now.isoformat() + "Z", now.isoformat() + "Z"))
    review_aggregates.append((f"pra_{i:03d}", product_id, 4.5, 10, 0, 0, 1, 2, 7, now.isoformat() + "Z"))

# 10. Notifications, Payment Methods, Preferences, Activities (Increase to 100+)
notifications = []
payment_methods = []
notification_preferences = []
user_activities = []
for i in range(1, 101):
    user_id = f"usr_{i:03d}"
    notifications.append((f"ntf_{i:03d}", user_id, "", "", "ACCOUNT_UPDATE", "Welcome", "Hello user", "", "DASHBOARD", "DELIVERED", 1, "", "", now.isoformat() + "Z", now.isoformat() + "Z"))
    payment_methods.append((f"upm_{i:03d}", user_id, "CARD", "Primary Card", "4242", 12, 2028, "true", now.isoformat() + "Z", now.isoformat() + "Z"))

# Update preferences for all users
for idx, u in enumerate(users):
    notification_preferences.append((f"np_{idx:03d}", u[0], "true", "true", "true", "true", now.isoformat() + "Z"))

for i in range(1, 151):
    user_id = users[i % len(users)][0]
    user_activities.append((f"ua_{i:03d}", user_id, f"prd_{(i % 100) or 100:03d}", "VIEW_PRODUCT", "", "cat_women", "cat_women_1", 1.0, "{}", now.isoformat() + "Z"))

# Write all CSVs
write_csv("categories.csv", ["category_id", "category_name", "parent_category_id"], categories)
write_csv("brands.csv", ["id", "name", "slug", "logo_url", "description", "verified", "commission_rate", "api_enabled", "contact_email", "whatsapp_number", "created_at", "updated_at"], brands)
write_csv("users.csv", ["id", "email", "full_name", "password", "google_id", "auth_provider", "role", "brand_id", "created_at", "updated_at"], users)
write_csv("brand_members.csv", ["id", "user_id", "brand_id", "can_manage_products", "created_at"], brand_members)
write_csv("product_content_templates.csv", ["id", "type", "name", "content", "brand_id", "created_by_id", "created_at", "updated_at"], templates)
write_csv("products.csv", ["id", "brand_id", "approval_status", "name", "slug", "description", "gender", "color", "type", "actual_price", "sale_price", "discount_percentage", "price_pkr", "top_category", "sub_category", "sizes", "tags", "image_url", "stock", "is_active", "created_at", "updated_at"], product_rows)
write_csv("carts.csv", ["id", "user_id", "created_at", "updated_at"], carts)
write_csv("cart_items.csv", ["id", "cart_id", "product_id", "quantity", "selected_color", "selected_size", "created_at", "updated_at"], cart_items)
write_csv("wishlist_items.csv", ["id", "user_id", "product_id", "created_at"], wishlist)
write_csv("orders.csv", ["id", "user_id", "status", "payment_method", "payment_status", "total_pkr", "delivery_address", "tracking_id", "created_at", "updated_at"], orders)
write_csv("sub_orders.csv", ["id", "order_id", "brand_id", "status", "subtotal_pkr", "tracking_id", "created_at", "updated_at"], sub_orders)
write_csv("order_items.csv", ["id", "order_id", "sub_order_id", "product_id", "brand_id", "quantity", "unit_price_pkr", "selected_color", "selected_size"], order_items)
write_csv("reviews.csv", ["id", "product_id", "user_id", "brand_id", "order_item_id", "rating", "title", "content", "status", "is_verified_purchase", "moderated_by_id", "moderation_reason", "moderated_at", "created_at", "updated_at"], reviews)
write_csv("review_images.csv", ["id", "review_id", "url", "sort_order", "created_at"], review_images)
write_csv("review_helpfulness_votes.csv", ["id", "review_id", "user_id", "is_helpful", "created_at", "updated_at"], review_votes)
write_csv("review_reports.csv", ["id", "review_id", "reported_by_user_id", "reason", "description", "status", "resolution_note", "resolved_by_id", "resolved_at", "created_at"], review_reports)
write_csv("brand_review_replies.csv", ["id", "review_id", "brand_id", "user_id", "content", "created_at", "updated_at"], brand_replies)
write_csv("product_review_aggregates.csv", ["id", "product_id", "average_rating", "total_reviews", "rating1", "rating2", "rating3", "rating4", "rating5", "updated_at"], review_aggregates)
write_csv("notifications.csv", ["id", "user_id", "brand_id", "order_id", "type", "title", "message", "read_at", "channel", "delivery_status", "delivery_attempts", "failed_reason", "next_attempt_at", "created_at", "updated_at"], notifications)
write_csv("user_payment_methods.csv", ["id", "user_id", "type", "label", "last4", "expires_month", "expires_year", "is_default", "created_at", "updated_at"], payment_methods)
write_csv("notification_preferences.csv", ["id", "user_id", "order_updates", "promo_emails", "security_alerts", "wishlist_alerts", "updated_at"], notification_preferences)
write_csv("user_activities.csv", ["id", "user_id", "product_id", "event_type", "search_query", "top_category", "sub_category", "weight", "metadata", "created_at"], user_activities)
