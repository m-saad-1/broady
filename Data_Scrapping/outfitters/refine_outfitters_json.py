import json
import re
from datetime import datetime

in_path = "d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_fashion_marketplace.json"
out_path = "d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_fashion_marketplace_refined.json"

with open(in_path, "r", encoding="utf-8") as f:
    products = json.load(f)


def normalize_text(text):
    if not isinstance(text, str):
        return None
    text = text.strip()
    return text if text else None


def is_code_line(line):
    if not line or len(line) > 60:
        return False
    if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-/]+", line):
        return True
    if re.fullmatch(r"[A-Z0-9]{4,20}", line):
        return True
    return False


def extract_fit(description):
    if not description:
        return None, None
    raw_lines = [line for line in description.splitlines()]
    fit = None
    desc_lines = []
    skip_next_code = False
    skip_next_fit = False
    for idx, line in enumerate(raw_lines):
        trimmed = line.strip()
        if not trimmed:
            continue
        if skip_next_fit:
            skip_next_fit = False
            continue
        if skip_next_code:
            skip_next_code = False
            if is_code_line(trimmed):
                continue
        label_match = re.match(r"^(FIT|DESIGN CODE|SKU|STYLE CODE|PRODUCT CODE)\s*[:\-]?\s*(.*)$", trimmed, re.IGNORECASE)
        if label_match:
            label = label_match.group(1).upper()
            content = label_match.group(2).strip()
            if label == "FIT":
                if content and not content.upper().startswith("DESIGN CODE") and not content.upper().startswith("SKU"):
                    fit = content
                else:
                    skip_next_fit = True
                continue
            if label in {"DESIGN CODE", "SKU", "STYLE CODE", "PRODUCT CODE"}:
                if content and is_code_line(content):
                    continue
                if content and not is_code_line(content):
                    continue
                skip_next_code = True
                continue
        if is_code_line(trimmed) and idx > 0 and raw_lines[idx - 1].strip().upper().startswith("SKU"):
            continue
        if re.match(r"^[A-Z\s]+:$", trimmed) and trimmed.upper() not in {"FIT:", "SIZE GUIDE:", "RETURN POLICY:", "CARE INSTRUCTIONS:"}:
            continue
        if trimmed.lower() in {"design code", "sku", "fit", "style code", "product code"}:
            continue
        desc_lines.append(trimmed)
    description_clean = "\n".join(desc_lines).strip()
    return fit, description_clean


def is_fit_description(text):
    if not text:
        return True
    normalized = text.strip()
    if len(normalized.split()) < 8:
        return True
    fit_terms = re.findall(r"\b(fit|silhouette|hips?|thighs?|shoulder|waist|body|tapered|relaxed|straight|slim|regular|oversized|snug|tailored|fitted)\b", normalized, re.IGNORECASE)
    if fit_terms:
        return True
    return False


def normalize_stock_status(status):
    if not status:
        return "out_of_stock"
    status = status.lower().strip()
    if status in {"in_stock", "available", "add to cart", "available to order", "instock"}:
        return "in_stock"
    if status in {"only few left", "low_stock", "low stock", "low stock/limited", "limited"}:
        return "low_stock"
    if status in {"sold_out", "sold out", "unavailable", "disabled size", "out_of_stock", "oos"}:
        return "out_of_stock"
    return "in_stock"


def text_to_lines(text):
    if not text:
        return []
    lines = []
    for raw in text.splitlines():
        raw = raw.strip()
        if raw:
            lines.append(raw)
    return lines


def parse_size_chart(text):
    if not text:
        return None
    lines = [line.strip() for line in text.replace("\r", "").splitlines() if line.strip()]
    if not lines:
        return None
    headers = []
    entries = []
    if len(lines) == 1 and "|" in lines[0]:
        headers = [h.strip() for h in lines[0].split("|")]
        return {"details": [lines[0]], "entries": []}
    if "|" in lines[0]:
        headers = [h.strip() for h in lines[0].split("|")]
        size_names = headers[1:]
        for row in lines[1:]:
            cols = [col.strip() for col in row.split("|")]
            if len(cols) < 2:
                continue
            field = cols[0]
            for idx, size in enumerate(size_names, start=1):
                if idx < len(cols):
                    entries.append({
                        "size": size,
                        "label": field,
                        "value": cols[idx]
                    })
        return {"details": lines, "entries": entries}
    return {"details": lines}


def normalize_images(images):
    seen = set()
    output = []
    for img in sorted(images, key=lambda x: x.get("position", 0)):
        url = img.get("url") or img.get("src") or img.get("image_url")
        if not url:
            continue
        url = url.strip()
        if url in seen:
            continue
        seen.add(url)
        output.append({
            "sourceUrl": url,
            "url": url,
            "altText": img.get("alt_text") or img.get("alt") or img.get("image_alt") or "",
            "imageType": img.get("image_type") or ("main" if img.get("position") == 1 else "gallery"),
            "isPrimary": img.get("position") == 1,
            "sortOrder": int(img.get("position", 0)) if img.get("position") is not None else len(output)
        })
    if output and not any(item["isPrimary"] for item in output):
        output[0]["isPrimary"] = True
    return output


refined = []
for product in products:
    fit, description = extract_fit(product.get("description"))
    if description == "":
        description = None
    elif is_fit_description(description):
        description = None
    shipping_delivery_value = normalize_text(product.get("shipping_delivery"))
    delivery_text = normalize_text(product.get("delivery_text"))
    if delivery_text:
        estimated_delivery_time = delivery_text
    elif shipping_delivery_value:
        m = re.search(r"(delivered in \d+[-–]\d+ working days|delivered in \d+[-–]\d+ days|up to \d+-\d+ working days)", shipping_delivery_value, re.IGNORECASE)
        estimated_delivery_time = m.group(1) if m else None
    else:
        estimated_delivery_time = None

    actual_price = product.get("actual_price") or product.get("price") or product.get("compare_at_price")
    sale_price = product.get("sale_price")
    if sale_price is not None and sale_price == actual_price:
        sale_price = None
    sold_price = product.get("price")
    if sale_price is None and sold_price is not None and sold_price != actual_price:
        sale_price = sold_price

    normalized_variants = []
    colors = []
    sizes = []
    for variant in product.get("variants", []):
        color = normalize_text(variant.get("color_name") or variant.get("color") or variant.get("option1"))
        size = normalize_text(variant.get("size") or variant.get("option2"))
        if color and color not in colors:
            colors.append(color)
        if size and size not in sizes:
            sizes.append(size)
        status = normalize_stock_status(variant.get("stock_status") or variant.get("availability") or variant.get("is_available"))
        quantity = variant.get("inventory_quantity") if isinstance(variant.get("inventory_quantity"), int) else None
        if quantity is None and variant.get("quantity") is not None:
            quantity = variant.get("quantity")
        if quantity is None:
            quantity = 0 if status == "out_of_stock" else 10
        normalized_variants.append({
            "externalVariantId": normalize_text(variant.get("external_variant_id") or variant.get("variant_id") or variant.get("sku")),
            "sku": normalize_text(variant.get("sku")),
            "barcode": normalize_text(variant.get("barcode")),
            "color": color,
            "size": size,
            "fit": fit,
            "pricePkr": variant.get("price") or actual_price,
            "salePricePkr": None if status == "out_of_stock" else (variant.get("price") if (variant.get("price") is not None and product.get("compare_at_price") and variant.get("price") < product.get("compare_at_price")) else None),
            "compareAtPricePkr": variant.get("compare_at_price") or actual_price,
            "stockStatus": status,
            "quantity": quantity,
            "isActive": bool(variant.get("is_available") or status == "in_stock")
        })

    if not colors:
        colors = [normalize_text(product.get("title"))] if product.get("title") else []
    if not sizes:
        sizes = []

    fabric_composition = normalize_text(product.get("fabric_composition"))
    care_lines = text_to_lines(product.get("care_guide"))
    shipping_lines = text_to_lines(shipping_delivery_value)
    return_policy = normalize_text(product.get("return_exchange_policy"))
    disclaimer = normalize_text(product.get("disclaimer"))
    size_guide = parse_size_chart(product.get("size_guide_text"))

    seo = {}
    if product.get("meta_title"):
        seo["metaTitle"] = product["meta_title"]
    if product.get("meta_description"):
        seo["metaDescription"] = product["meta_description"]
    if product.get("canonical_url"):
        seo["canonicalUrl"] = product["canonical_url"]

    refined_product = {
        "id": product.get("id"),
        "external_product_id": product.get("external_product_id"),
        "external_source": "scraper",
        "brand_name": product.get("brand_name"),
        "title": product.get("title"),
        "slug": product.get("slug"),
        "short_description": None,
        "description": description,
        "gender": product.get("gender"),
        "category": product.get("category"),
        "subcategory": product.get("subcategory"),
        "product_type": product.get("product_type"),
        "fit": fit,
        "season": None,
        "collection": None,
        "product_url": product.get("product_url"),
        "actual_price": actual_price,
        "sale_price": sale_price,
        "currency": product.get("currency") or "PKR",
        "label": None,
        "colors": colors,
        "sizes": sizes,
        "variants": normalized_variants,
        "images": normalize_images(product.get("images", [])),
        "size_guide": size_guide,
        "shipping_delivery": {
            "estimatedDeliveryTime": estimated_delivery_time,
            "regions": ["Pakistan"],
            "charges": "298 PKR + FBR POS Fee 1 PKR" if shipping_delivery_value else None
        },
        "deliveries_returns": {
            "returnPolicy": return_policy,
            "refundConditions": None
        },
        "fabric_care": {
            "fabricType": fabric_composition,
            "careInstructions": care_lines
        },
        "detail": {
            "fitDetails": fit,
            "fabricComposition": fabric_composition,
            "careGuide": "\n".join(care_lines) if care_lines else None,
            "sizeGuideText": "\n".join(size_guide["details"]) if size_guide and size_guide.get("details") else None,
            "returnExchangePolicy": return_policy,
            "disclaimer": disclaimer,
            "materialDetails": fabric_composition,
            "origin": None,
            "packageIncludes": None
        },
        "seo": seo,
        "additional_info": [],
        "raw": {
            "sourceUrl": product.get("product_url"),
            "scrapedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "originalProductJson": product
        }
    }

    refined_product["shipping_delivery"] = {k: v for k, v in refined_product["shipping_delivery"].items() if v is not None}
    refined_product["deliveries_returns"] = {k: v for k, v in refined_product["deliveries_returns"].items() if v is not None}
    refined_product["fabric_care"] = {k: v for k, v in refined_product["fabric_care"].items() if v is not None}
    refined_product["detail"] = {k: v for k, v in refined_product["detail"].items() if v is not None}
    refined_product["seo"] = {k: v for k, v in refined_product["seo"].items() if v is not None}
    if not refined_product["sale_price"]:
        refined_product.pop("sale_price", None)
    if not refined_product["additional_info"]:
        refined_product.pop("additional_info", None)

    refined.append(refined_product)

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(refined, f, indent=2, ensure_ascii=False)

print(f"Refined file written to {out_path}")
