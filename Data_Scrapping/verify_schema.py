import json

def check(label, path):
    data = json.load(open(path, encoding="utf-8"))
    p = data[0]
    v = p["variants"][0]
    img = p["images"][0]
    print(f"\n=== {label} ({len(data)} products) ===")
    print(f"  actual_price     : {p.get('actual_price')}")
    print(f"  sale_price       : {p.get('sale_price')}")
    print(f"  variants (lower) : {isinstance(p.get('variants'), list)}")
    print(f"  images (lower)   : {isinstance(p.get('images'), list)}")
    print(f"  variant option1  : {v.get('option1')}")
    print(f"  variant option2  : {v.get('option2')}")
    print(f"  inventory_qty    : {v.get('inventory_quantity')}")
    print(f"  image src        : {str(img.get('src',''))[:60]}")
    print(f"  meta_title       : {p.get('meta_title')}")
    print(f"  care_guide set   : {bool(p.get('care_guide'))}")
    print(f"  shipping_delivery: {bool(p.get('shipping_delivery'))}")
    # Check none of the old nested keys exist
    old_nested = [k for k in ["Pricing","Variants","Images","Details","Shipping","SEO"] if k in p]
    print(f"  old nested keys  : {old_nested if old_nested else 'NONE (good)'}")

check("COUGAR", "cougar/broady_fashion_marketplace.json")
check("OUTFITTERS", "outfitters/outfitters_fashion_marketplace.json")
print("\nAll checks done. Upload both files to Broady.")
