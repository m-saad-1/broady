import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

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

categories = [
    ("cat_women", "Women", ""),
    ("cat_tops", "Tops", "cat_women"),
    ("cat_dresses", "Dresses", "cat_women"),
    ("cat_knitwear", "Knitwear", "cat_women"),
    ("cat_accessories", "Accessories", "cat_women"),
    ("cat_loungewear", "Loungewear", "cat_women"),
    ("cat_active", "Activewear", "cat_women"),
]

brands = [
    ("br_heritage", "Heritage Loom", "heritage-loom", "https://cdn.example.com/brands/heritage.png", "Contemporary womenswear brand.", "true", "12.00", "false", "hello@heritageloom.test", "+923001111111", now.isoformat() + "Z", now.isoformat() + "Z"),
    ("br_nova", "Nova Stitch", "nova-stitch", "https://cdn.example.com/brands/nova.png", "Minimal essentials and occasion wear.", "true", "10.50", "false", "support@novastitch.test", "+923002222222", now.isoformat() + "Z", now.isoformat() + "Z"),
    ("br_verve", "Verve Atelier", "verve-atelier", "https://cdn.example.com/brands/verve.png", "Elegant ready-to-wear with a modern edge.", "true", "11.00", "false", "hello@verveatelier.test", "+923003333333", now.isoformat() + "Z", now.isoformat() + "Z"),
    ("br_mira", "Mira Mode", "mira-mode", "https://cdn.example.com/brands/mira.png", "Premium day-to-night clothing.", "true", "13.00", "false", "contact@miramode.test", "+923004444444", now.isoformat() + "Z", now.isoformat() + "Z"),
    ("br_rise", "Rise Studio", "rise-studio", "https://cdn.example.com/brands/rise.png", "Bold sustainable fashion essentials.", "true", "9.50", "false", "support@risestudio.test", "+923005555555", now.isoformat() + "Z", now.isoformat() + "Z"),
    ("br_luna", "Luna Threads", "luna-threads", "https://cdn.example.com/brands/luna.png", "Comfortable feminine silhouettes.", "true", "10.75", "false", "hello@lunathreads.test", "+923006666666", now.isoformat() + "Z", now.isoformat() + "Z"),
]

users = [
    ("usr_admin", "admin@broady.test", "Broady Admin", "", "", "LOCAL", "ADMIN", "", now.isoformat() + "Z", now.isoformat() + "Z"),
]
for i in range(1, 56):
    users.append((
        f"usr_{i:03d}",
        f"user{i}@example.test",
        f"User {i}",
        "hashed-password",
        "",
        "LOCAL",
        "USER",
        "",
        now.isoformat() + "Z",
        now.isoformat() + "Z",
    ))
users.append(("usr_heritage_mgr", "manager@heritageloom.test", "Hira Manager", "", "", "LOCAL", "BRAND", "br_heritage", now.isoformat() + "Z", now.isoformat() + "Z"))
users.append(("usr_nova_mgr", "manager@novastitch.test", "Nadia Manager", "", "", "LOCAL", "BRAND", "br_nova", now.isoformat() + "Z", now.isoformat() + "Z"))
users.append(("usr_verve_mgr", "manager@verveatelier.test", "Mina Verve", "", "", "LOCAL", "BRAND", "br_verve", now.isoformat() + "Z", now.isoformat() + "Z"))
users.append(("usr_mira_mgr", "manager@miramode.test", "Ayesha Mira", "", "", "LOCAL", "BRAND", "br_mira", now.isoformat() + "Z", now.isoformat() + "Z"))
users.append(("usr_rise_mgr", "manager@risestudio.test", "Zara Rise", "", "", "LOCAL", "BRAND", "br_rise", now.isoformat() + "Z", now.isoformat() + "Z"))
users.append(("usr_luna_mgr", "manager@lunathreads.test", "Luna Khan", "", "", "LOCAL", "BRAND", "br_luna", now.isoformat() + "Z", now.isoformat() + "Z"))

brand_members = []
member_user_ids = [u[0] for u in users if u[6] == "BRAND"]
for idx, user_id in enumerate(member_user_ids, start=1):
    brand_members.append((f"bm_{idx:03d}", user_id, brands[(idx - 1) % len(brands)][0], "true", now.isoformat() + "Z"))
for idx in range(len(brand_members) + 1, 31):
    brand_members.append((f"bm_{idx:03d}", f"usr_{idx:03d}", brands[(idx - 1) % len(brands)][0], "false", now.isoformat() + "Z"))

templates = []
for j, (brand_id, brand_name, slug, logo_url, description, verified, rate, api_enabled, email, phone, created_at, updated_at) in enumerate(brands, start=1):
    for k in range(1, 6):
        templates.append((
            f"pct_{(j - 1) * 6 + k:03d}",
            "DESCRIPTION" if k % 2 == 1 else "SIZE_GUIDE",
            f"{brand_name} Template {k}",
            json.dumps({"tone": "premium", "length": "short"} if k % 2 == 1 else {"sizes": ["S", "M", "L"]}),
            brand_id,
            member_user_ids[(j - 1) % len(member_user_ids)],
            now.isoformat() + "Z",
            now.isoformat() + "Z",
        ))

for idx in range(len(brands) * 6 + 1, 51):
    brand_id = brands[(idx - 1) % len(brands)][0]
    templates.append((
        f"pct_{idx:03d}",
        "DESCRIPTION",
        f"Additional Template {idx}",
        json.dumps({"tone": "standard", "length": "medium"}),
        brand_id,
        member_user_ids[(idx - 1) % len(member_user_ids)],
        now.isoformat() + "Z",
        now.isoformat() + "Z",
    ))

product_rows = []
for idx in range(1, 61):
    brand = brands[(idx - 1) % len(brands)][0]
    cat = categories[(idx - 1) % len(categories)][0]
    subcat = categories[((idx - 1) + 1) % len(categories)][0]
    if subcat == "cat_women":
        subcat = "cat_tops"
    name = f"Product {idx}"
    product_rows.append((
        f"prd_{idx:03d}",
        brand,
        "APPROVED",
        name,
        name.lower().replace(" ", "-"),
        f"Description for {name}.",
        "WOMEN",
        ["Black", "White", "Red", "Navy", "Rose"][idx % 5],
        ["Top", "Dress", "Knitwear", "Accessory", "Loungewear", "Activewear"][idx % 6],
        4200.00 + idx * 10,
        3690.00 + idx * 10,
        12.0 if idx % 2 == 0 else 10.0,
        3690 + idx * 5,
        cat,
        subcat,
        json.dumps(["S", "M", "L"] if idx % 3 == 0 else ["M", "L"]),
        json.dumps(["new", "season"] if idx % 2 == 0 else ["classic", "everyday"]),
        f"https://cdn.example.com/products/prd_{idx:03d}.jpg",
        20 + idx,
        "true",
        now.isoformat() + "Z",
        now.isoformat() + "Z",
    ))

carts = []
cart_items = []
wishlist = []
for i in range(1, 51):
    carts.append((f"cart_{i:03d}", f"usr_{i:03d}", now.isoformat() + "Z", now.isoformat() + "Z"))
    for j in range(1, 3):
        product_id = f"prd_{(i * j) % 60 or 60:03d}"
        cart_items.append((f"ci_{i:03d}_{j}", f"cart_{i:03d}", product_id, j, "Black" if j % 2 == 0 else "White", "M", now.isoformat() + "Z", now.isoformat() + "Z"))
    if i <= 50:
        wishlist.append((f"wl_{i:03d}", f"usr_{i:03d}", f"prd_{(i % 60) or 60:03d}", now.isoformat() + "Z"))

orders = []
sub_orders = []
order_items = []
for i in range(1, 51):
    user_id = f"usr_{i:03d}"
    orders.append((f"ord_{i:03d}", user_id, "CONFIRMED" if i % 3 != 0 else "PENDING", "COD" if i % 2 == 0 else "CARD", "PAID" if i % 2 == 1 else "PENDING", 5000 + i * 50, f"Address {i}, City", f"TRK-{1000+i}", now.isoformat() + "Z", now.isoformat() + "Z"))
    brands_for_order = [brands[i % len(brands)][0], brands[(i + 1) % len(brands)][0]]
    subtotal = 0
    for bidx, brand_id in enumerate(brands_for_order, start=1):
        sub_id = f"sub_{i:03d}_{bidx}"
        amount = 3000 + i * 20 + bidx * 100
        sub_orders.append((sub_id, f"ord_{i:03d}", brand_id, "CONFIRMED", amount, f"SUB-{1000 + i * 10 + bidx}", now.isoformat() + "Z", now.isoformat() + "Z"))
        for item_count in range(1, 3):
            prod_index = ((i * bidx * item_count) % 60) or 60
            product_id = f"prd_{prod_index:03d}"
            order_items.append((f"oi_{i:03d}_{bidx}_{item_count}", f"ord_{i:03d}", sub_id, product_id, brand_id, item_count, 2500 + prod_index * 5, "Black", "M"))
            subtotal += 2500 + prod_index * 5

reviews = []
review_images = []
review_votes = []
review_reports = []
brand_replies = []
review_aggregates = []
for i in range(1, 61):
    product_id = f"prd_{(i % 60) or 60:03d}"
    user_id = f"usr_{((i + 5) % 56) or 56:03d}"
    brand_id = brands[i % len(brands)][0]
    order_item_id = f"oi_{((i % 50) or 50):03d}_1_1"
    reviews.append((f"rev_{i:03d}", product_id, user_id, brand_id, order_item_id, (i % 5) + 1, f"Review title {i}", f"This is a sample review for product {product_id}.", "VISIBLE", "true", "usr_admin", "", "", now.isoformat() + "Z", now.isoformat() + "Z"))
    for j in range(1, 3):
        review_images.append((f"ri_{i:03d}_{j}", f"rev_{i:03d}", f"https://cdn.example.com/reviews/rev_{i:03d}_{j}.jpg", j-1, now.isoformat() + "Z"))
    for j in range(1, 4):
        review_votes.append((f"rhv_{i:03d}_{j}", f"rev_{i:03d}", f"usr_{((i+5*j) % 56) or 56:03d}", "true" if j % 2 == 0 else "false", now.isoformat() + "Z", now.isoformat() + "Z"))
    if i % 2 == 0:
        review_reports.append((f"rr_{i:03d}", f"rev_{i:03d}", f"usr_{((i+15) % 56) or 56:03d}", "SPAM", f"Example report description for review {i}.", "RESOLVED", "Looks valid.", "usr_admin", now.isoformat() + "Z"))
    if i % 3 == 0:
        brand_replies.append((f"brr_{i:03d}", f"rev_{i:03d}", brand_id, f"usr_{((i+20) % 56) or 56:03d}", "Thank you for the review.", now.isoformat() + "Z", now.isoformat() + "Z"))

for i in range(1, 61):
    review_aggregates.append((f"pra_{i:03d}", f"prd_{i:03d}", float(((i % 5) + 1) * 1.0), i % 10, i % 3, i % 4, i % 5, i % 6, i % 7, now.isoformat() + "Z"))

# Ensure a richer support dataset for reports and replies
for i in range(len(review_reports) + 1, 51):
    review_id = f"rev_{((i - 1) % 60) + 1:03d}"
    review_reports.append((f"rr_{50 + i:03d}", review_id, f"usr_{((i+5) % 56) or 56:03d}", "OTHER", f"Additional moderation note for {review_id}.", "IN_REVIEW", "Pending review.", "usr_admin", now.isoformat() + "Z"))

for i in range(len(brand_replies) + 1, 51):
    review_id = f"rev_{((i - 1) % 60) + 1:03d}"
    brand_replies.append((f"brr_{50 + i:03d}", review_id, brands[i % len(brands)][0], f"usr_{((i+20) % 56) or 56:03d}", "Thank you for your detailed review.", now.isoformat() + "Z", now.isoformat() + "Z"))

notifications = []
for i in range(1, 91):
    user_id = f"usr_{((i % 56) or 56):03d}"
    brand_id = brands[i % len(brands)][0] if i % 3 == 0 else ""
    order_id = f"ord_{((i % 50) or 50):03d}"
    notifications.append((f"ntf_{i:03d}", user_id, brand_id or "", order_id, "ORDER_PLACED" if i % 2 == 0 else "ACCOUNT_UPDATE", f"Notification {i}", f"Message content for notification {i}.", "", "DASHBOARD", "DELIVERED" if i % 2 == 0 else "QUEUED", i % 3, "", "", now.isoformat() + "Z", now.isoformat() + "Z"))

payment_methods = []
for i in range(1, 71):
    user_id = f"usr_{((i % 56) or 56):03d}"
    payment_methods.append((f"upm_{i:03d}", user_id, "CARD" if i % 2 == 0 else "JAZZCASH", f"Card {i}", f"{1000+i:04d}", 6 + (i % 6), 2026 + (i % 4), "true" if i % 5 == 0 else "false", now.isoformat() + "Z", now.isoformat() + "Z"))

notification_preferences = []
for i in range(1, 57):
    notification_preferences.append((f"np_{i:03d}", f"usr_{i:03d}", "true", "false" if i % 2 == 0 else "true", "true", "true" if i % 3 != 0 else "false", now.isoformat() + "Z"))

user_activities = []
for i in range(1, 101):
    user_id = f"usr_{((i % 56) or 56):03d}"
    product_id = f"prd_{((i % 60) or 60):03d}" if i % 4 != 0 else ""
    event_type = ["VIEW_PRODUCT", "SEARCH", "ADD_TO_WISHLIST", "PURCHASE"][i % 4]
    user_activities.append((
        f"ua_{i:03d}",
        user_id,
        product_id,
        event_type,
        "cotton top" if event_type == "SEARCH" else "",
        "cat_women",
        "cat_tops",
        "1.00" if event_type == "VIEW_PRODUCT" else "0.75",
        json.dumps({"source": "homepage" if event_type == "VIEW_PRODUCT" else "search" if event_type == "SEARCH" else "wishlist"}),
        now.isoformat() + "Z",
    ))

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
