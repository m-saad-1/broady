"""
fix_schema.py
=============
Converts our custom BROADY-schema JSON files into the flat format
that Broady's normalization.service.ts actually reads.

Root causes fixed:
  1. Variants / Images (Capital V/I) -> variants / images (lowercase)
  2. image_url field in images -> src (what normalization reads)
  3. Pricing{} nested object -> flattened actual_price / sale_price at top level
  4. color_name in variants -> also add option1 (what normalization reads for color)
  5. size in variants -> also add option2 (what normalization reads for size)
  6. stock_status string -> add inventory_quantity number (in_stock=10, out=0)
  7. Details{} nested object -> flatten care_guide, shipping_delivery, etc. to top level
  8. Shipping{} nested object -> flatten estimated_delivery_min_days etc. to top level
  9. SEO{} nested object -> flatten meta_title to top level
"""

import json
import sys
import os

def fix_product(p):
    """Remap one product record to match normalization.service.ts expectations."""
    fixed = {}

    # ---- Top-level scalar fields (pass through as-is) ----
    for key in [
        "id", "external_product_id", "brand_id", "brand_name",
        "title", "slug", "description", "gender", "category",
        "subcategory", "product_type", "status", "visibility",
        "source", "product_url", "created_at", "updated_at", "tags"
    ]:
        if key in p:
            fixed[key] = p[key]

    # ---- FIX 3: Flatten Pricing -> top-level price fields ----
    pricing = p.get("Pricing", {})
    actual = pricing.get("actual_price") or 0.0
    sale   = pricing.get("discounted_price") or pricing.get("final_price") or actual
    fixed["actual_price"]         = actual
    fixed["sale_price"]           = sale if sale < actual else None
    fixed["compare_at_price"]     = actual
    fixed["price"]                = sale if sale < actual else actual
    fixed["currency"]             = pricing.get("currency", "PKR")
    fixed["discount_percentage"]  = pricing.get("discount_percentage", 0)
    fixed["is_on_sale"]           = pricing.get("is_on_sale", False)

    # ---- FIX 1+2+4+5+6: Fix variants ----
    raw_variants = p.get("Variants") or p.get("variants") or []
    new_variants = []
    for v in raw_variants:
        color = v.get("color_name") or v.get("color") or v.get("option1") or "Default"
        size  = v.get("size") or v.get("option2") or "One Size"
        is_avail = v.get("is_available", True)
        if v.get("stock_status") == "out_of_stock":
            is_avail = False
        qty = 0 if not is_avail else 10   # inventory_quantity as a number

        new_v = {
            # Keep original fields
            **v,
            # FIX 4+5: Add option1/option2 aliases so normalization can read color/size
            "option1": color,
            "option2": size,
            "color":   color,
            # FIX 2 (variant level): rename image_url -> src if present
            # FIX 6: add inventory_quantity as a number
            "inventory_quantity": qty,
            "stock_status": v.get("stock_status", "in_stock" if is_avail else "out_of_stock"),
        }
        new_variants.append(new_v)
    fixed["variants"] = new_variants   # FIX 1: lowercase key

    # ---- FIX 1+2: Fix images ----
    raw_images = p.get("Images") or p.get("images") or []
    new_images = []
    for img in raw_images:
        url = img.get("image_url") or img.get("src") or img.get("url") or ""
        new_images.append({
            **img,
            "src": url,   # FIX 2: add 'src' which is what normalization reads
            "url": url,   # also add 'url' alias
        })
    fixed["images"] = new_images   # FIX 1: lowercase key

    # ---- FIX 7: Flatten Details -> top-level ----
    details = p.get("Details", {})
    fixed["fabric_composition"]      = details.get("fabric_composition")
    fixed["care_guide"]              = details.get("care_guide", "")
    fixed["size_guide_text"]         = details.get("size_guide_text", "")
    fixed["shipping_delivery"]       = details.get("shipping_delivery", "")
    fixed["return_exchange_policy"]  = details.get("return_exchange_policy", "")
    fixed["disclaimer"]              = details.get("disclaimer", "")

    # ---- FIX 8: Flatten Shipping -> top-level ----
    shipping = p.get("Shipping", {})
    fixed["estimated_delivery_min_days"] = shipping.get("estimated_delivery_min_days")
    fixed["estimated_delivery_max_days"] = shipping.get("estimated_delivery_max_days")
    fixed["delivery_text"]               = shipping.get("delivery_text", "")
    fixed["cod_available"]               = shipping.get("cod_available", True)
    fixed["return_available"]            = shipping.get("return_available", True)
    fixed["exchange_available"]          = shipping.get("exchange_available", True)

    # ---- FIX 9: Flatten SEO -> top-level ----
    seo = p.get("SEO", {})
    fixed["meta_title"]       = seo.get("meta_title", p.get("title", ""))
    fixed["meta_description"] = seo.get("meta_description", "")
    fixed["canonical_url"]    = seo.get("canonical_url", p.get("product_url", ""))

    return fixed


def fix_file(input_path, output_path):
    print(f"Reading: {input_path}")
    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        fixed = [fix_product(p) for p in data]
    else:
        fixed = fix_product(data)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fixed, f, ensure_ascii=False, indent=2)

    count = len(fixed) if isinstance(fixed, list) else 1
    print(f"  Fixed {count} products -> {output_path}")


if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))

    files = [
        (
            os.path.join(base, "cougar", "broady_fashion_marketplace.json"),
            os.path.join(base, "cougar", "broady_fashion_marketplace.json"),
        ),
        (
            os.path.join(base, "outfitters", "outfitters_fashion_marketplace.json"),
            os.path.join(base, "outfitters", "outfitters_fashion_marketplace.json"),
        ),
        (
            os.path.join(base, "outfitters", "women_artisanal_products.json"),
            os.path.join(base, "outfitters", "women_artisanal_products.json"),
        ),
    ]

    for inp, out in files:
        if os.path.exists(inp):
            fix_file(inp, out)
        else:
            print(f"  SKIP (not found): {inp}")

    print("\nAll done! Upload the fixed files to Broady.")
