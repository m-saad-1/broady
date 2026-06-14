import json
import re
from pathlib import Path
from datetime import datetime

IN_PATH = Path('d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_10_per_collection.json')
OUT_PATH = Path('d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_10_per_collection_refined.json')


def normalize_text(text):
    if not isinstance(text, str):
        return None
    t = text.strip()
    return t if t else None


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


def make_slug_from_url(url):
    if not url:
        return None
    parts = url.rstrip('/').split('/')
    return parts[-1] if parts else None


def normalize_image(img):
    if not img:
        return []
    return [{"url": img, "isPrimary": True, "altText": None}]


if __name__ == '__main__':
    data = json.loads(IN_PATH.read_text(encoding='utf-8'))
    refined = []
    for coll in data:
        coll_url = coll.get('collection_url')
        for prod in coll.get('products', []):
            title = normalize_text(prod.get('title'))
            product_url = normalize_text(prod.get('product_url'))
            external_product_id = normalize_text(prod.get('external_product_id') or make_slug_from_url(product_url))
            raw_desc = prod.get('description')
            fit, desc = extract_fit(raw_desc)
            if desc == "":
                desc = None
            elif not desc or is_fit_description(desc):
                desc = None
            images = normalize_image(prod.get('image'))
            price = prod.get('price')
            sale_price = prod.get('sale_price')
            refined.append({
                "external_product_id": external_product_id,
                "collection_url": coll_url,
                "title": title,
                "slug": make_slug_from_url(product_url),
                "description": desc,
                "fit": fit,
                "product_url": product_url,
                "images": images,
                "price": price,
                "sale_price": sale_price,
                "currency": "PKR",
                "raw": prod,
                "scrapedAt": datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            })
    OUT_PATH.write_text(json.dumps(refined, indent=2, ensure_ascii=False), encoding='utf-8')
    print('Wrote', OUT_PATH)
