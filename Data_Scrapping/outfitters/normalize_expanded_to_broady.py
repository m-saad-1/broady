import json
import re
from pathlib import Path
from datetime import datetime

from bs4 import BeautifulSoup

EXPANDED_PATH = Path('d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_10_per_collection_expanded.json')
ORIG_PATH = Path('d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_fashion_marketplace.json')
ORIG_FALLBACK_PATH = Path('d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_fashion_marketplace_refined.json')
OUT_PATH = Path('d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_10_per_collection_broady.json')

LABELS = [
    r'FIT', r'FABRIC', r'FABRIC & CARE', r'COMPOSITION', r'CARE INSTRUCTIONS', r'SIZE GUIDE',
    r'SIZE CHART', r'SHIPPING', r'DELIVERY', r'RETURNS', r'RETURN & EXCHANGE', r'EXCHANGE POLICY',
    r'DISCLAIMER', r'MODEL DETAILS', r'MATERIAL', r'ORIGIN', r'PACKAGE INCLUDES'
]

def label_to_pattern(label):
    return r"\\b" + r"\\s+".join([re.escape(p) for p in label.split()]) + r"\\b"


LABEL_RE = re.compile(r"^(%s)\\s*[:\\-]?" % "|".join([label_to_pattern(l) for l in LABELS]), re.IGNORECASE)


def normalize_text(t):
    if isinstance(t, (int, float)):
        t = str(t)
    if not isinstance(t, str):
        return None
    s = t.strip()
    return s if s else None


def normalize_label_text(text):
    if not text:
        return text
    normalized = text
    for label in LABELS:
        pattern = label_to_pattern(label)
        normalized = re.sub(r"(?i)(?<!^)" + pattern + r"\\s*[:\\-]", r"\n" + label + ":", normalized)
    return normalized


def html_to_text_with_lines(html):
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator="\n", strip=True)
    return text if text else None


def remove_labeled_sections(text):
    if not text:
        return None, {}
    text = normalize_label_text(text)
    lines = [l.rstrip() for l in text.splitlines()]
    details = {
        'fit': None,
        'fabric_composition': None,
        'care_instructions': None,
        'size_guide_text': None,
        'shipping_delivery': None,
        'return_exchange_policy': None,
        'disclaimer': None,
        'model_details': None,
    }
    out_lines = []
    buffer_label = None
    buffer = []
    def flush_buffer():
        nonlocal buffer_label, buffer
        if buffer_label and buffer:
            txt = '\n'.join(buffer).strip()
            key = buffer_label
            if key == 'FIT':
                details['fit'] = txt
            elif key in ('FABRIC','COMPOSITION','FABRIC & CARE'):
                # set to fabric composition if looks like composition, else care
                if re.search(r'\d+%|%|cotton|poly|nylon|viscose|bamboo|polyester', txt, re.IGNORECASE):
                    details['fabric_composition'] = txt
                else:
                    details['care_instructions'] = txt
            elif key in ('CARE INSTRUCTIONS', 'CARE'):
                details['care_instructions'] = txt
            elif key in ('SIZE GUIDE', 'SIZE CHART'):
                details['size_guide_text'] = txt
            elif key in ('SHIPPING','DELIVERY'):
                details['shipping_delivery'] = txt
            elif key in ('RETURNS','RETURN & EXCHANGE','EXCHANGE POLICY'):
                details['return_exchange_policy'] = txt
            elif key == 'DISCLAIMER':
                details['disclaimer'] = txt
            elif key == 'MODEL DETAILS':
                details['model_details'] = txt
        buffer_label = None
        buffer = []
    for line in lines:
        if not line.strip():
            # blank lines: flush and continue
            if buffer_label:
                buffer.append('')
            else:
                out_lines.append('')
            continue
        m = LABEL_RE.match(line.strip())
        if m:
            # flush previous
            flush_buffer()
            # start new buffer for this label
            buffer_label = m.group(1).upper()
            rest = line[m.end():].strip()
            if rest:
                buffer.append(rest)
            continue
        if buffer_label:
            buffer.append(line)
        else:
            out_lines.append(line)
    flush_buffer()
    description = '\n'.join([l for l in out_lines if l.strip()]).strip()
    return (description if description else None), details


def parse_size_guide_sizes(size_text):
    if not size_text:
        return []
    for line in size_text.splitlines():
        if re.match(r"^SIZE\s*\|", line.strip(), re.IGNORECASE):
            parts = [p.strip() for p in line.split('|')[1:] if p.strip()]
            return parts
    return []


def clean_dict(value):
    if not isinstance(value, dict):
        return value
    cleaned = {k: v for k, v in value.items() if v is not None and v != []}
    return cleaned if cleaned else None


def make_image_objs(img_list):
    out = []
    seen = set()
    for i, url in enumerate(img_list):
        if not url:
            continue
        if url.startswith("//"):
            url = "https:" + url
        if url in seen:
            continue
        seen.add(url)
        out.append({
            'sourceUrl': url,
            'url': url,
            'altText': None,
            'imageType': 'main' if i == 0 else 'gallery',
            'isPrimary': i == 0,
            'sortOrder': i
        })
    return out


def normalize_price(orig):
    if not orig:
        return None, None, None
    actual = orig.get('actual_price') or orig.get('price') or orig.get('compare_at_price')
    sale = orig.get('sale_price')
    try:
        actual = float(actual) if actual is not None else None
    except Exception:
        actual = None
    try:
        sale = float(sale) if sale is not None else None
    except Exception:
        sale = None
    if sale is not None and actual is not None and sale >= actual:
        sale = None
    return actual, sale, orig.get('currency') or 'PKR'


def normalize_price_from_expanded(prod):
    current = prod.get('price')
    compare = prod.get('sale_price')
    for v in prod.get('variants') or []:
        if current is None:
            current = v.get('price')
        if compare is None:
            compare = v.get('compare_at_price')
        if current is not None and compare is not None:
            break
    try:
        current = float(current) if current is not None else None
    except Exception:
        current = None
    try:
        compare = float(compare) if compare is not None else None
    except Exception:
        compare = None
    if compare is not None and current is not None and compare > current:
        return compare, current, 'PKR'
    return current, None, 'PKR'


def classify_collection(collection_url):
    slug = (collection_url or '').rstrip('/').split('/')[-1].lower()
    if 'girls' in slug:
        gender = 'Girls'
    elif 'boys' in slug:
        gender = 'Boys'
    else:
        gender = 'Kids'
    if 'toddler' in slug:
        collection = 'Toddler'
    elif 'junior' in slug:
        collection = 'Junior'
    else:
        collection = None
    return gender, collection


def normalize_variants(expanded, orig, price_actual, price_sale):
    variants = []
    sizes = []
    colors = []
    options = expanded.get('options') or []
    option_names = []
    for opt in options:
        if isinstance(opt, dict) and opt.get('name'):
            option_names.append(opt.get('name').lower())
    # prefer expanded variants
    if expanded.get('variants'):
        for v in expanded['variants']:
            size = None
            color = None
            option_values = [v.get('option1'), v.get('option2'), v.get('option3')]
            for idx, opt_name in enumerate(option_names):
                if idx >= len(option_values):
                    continue
                if 'size' in opt_name:
                    size = option_values[idx]
                if 'color' in opt_name or 'colour' in opt_name:
                    color = option_values[idx]
            if not size:
                size = v.get('option2') or v.get('option1') or v.get('label') or v.get('size')
            sku = v.get('sku') or v.get('id') or f"{expanded.get('external_product_id')}-{size}" if size else v.get('id')
            quantity = v.get('inventory_quantity') if isinstance(v.get('inventory_quantity'), int) else None
            available = v.get('available')
            stock_status = 'in_stock' if available in (True, 'true', 'True', 1, '1') else 'out_of_stock' if available is False else 'in_stock'
            price_val = v.get('price') or price_actual
            compare_val = v.get('compare_at_price') or price_actual
            sale_val = None
            if price_val is not None and compare_val is not None and compare_val > price_val:
                sale_val = price_val
            elif price_sale is not None and price_actual is not None and price_sale < price_actual:
                sale_val = price_sale
            variant = {
                'externalVariantId': normalize_text(v.get('id') or sku),
                'sku': normalize_text(sku),
                'barcode': normalize_text(v.get('barcode')),
                'color': normalize_text(color),
                'size': normalize_text(size),
                'fit': None,
                'pricePkr': price_val,
                'salePricePkr': sale_val,
                'compareAtPricePkr': compare_val,
                'stockStatus': stock_status,
                'isActive': True if available is not False else False
            }
            if quantity is not None:
                variant['quantity'] = quantity
            for k in [k for k, v in list(variant.items()) if v is None]:
                variant.pop(k, None)
            variants.append(variant)
            if size:
                sizes.append(size)
            if color:
                colors.append(color)
    else:
        # construct variants from size guide header or expanded sizes
        found_sizes = parse_size_guide_sizes(orig.get('size_guide_text'))
        if not found_sizes:
            for s in expanded.get('sizes') or []:
                found_sizes.append(s)
        for s in found_sizes:
            sku = f"{expanded.get('external_product_id')}-{s}"
            variants.append({
                'externalVariantId': sku,
                'sku': sku,
                'barcode': None,
                'color': None,
                'size': s,
                'fit': None,
                'pricePkr': price_actual,
                'salePricePkr': price_sale,
                'compareAtPricePkr': price_actual,
                'stockStatus': 'in_stock',
                'isActive': True
            })
            sizes.append(s)
    # ensure sizes unique
    sizes = list(dict.fromkeys(sizes))
    colors = list(dict.fromkeys(colors))
    return variants, sizes, colors


if __name__ == '__main__':
    expanded = json.loads(EXPANDED_PATH.read_text(encoding='utf-8'))
    if ORIG_PATH.exists():
        orig_list = json.loads(ORIG_PATH.read_text(encoding='utf-8'))
    elif ORIG_FALLBACK_PATH.exists():
        orig_list = json.loads(ORIG_FALLBACK_PATH.read_text(encoding='utf-8'))
    else:
        orig_list = []
    orig_map = {p.get('external_product_id') or p.get('id'): p for p in orig_list}
    out = []
    for coll in expanded:
        coll_gender, coll_collection = classify_collection(coll.get('collection_url'))
        for prod in coll.get('products', []):
            ext_id = prod.get('external_product_id')
            orig = orig_map.get(ext_id, {})
            title = normalize_text(prod.get('title') or orig.get('title'))
            product_url = normalize_text(prod.get('product_url') or orig.get('product_url') or orig.get('canonical_url'))
            slug = normalize_text(ext_id or (product_url.split('/')[-1] if product_url else None))
            # merge descriptions: prefer expanded.description_html, then description_text
            src_desc = prod.get('description_text')
            if prod.get('description_html'):
                src_desc = html_to_text_with_lines(prod.get('description_html'))
            description, parts = remove_labeled_sections(src_desc)
            if not description and orig.get('description'):
                _, parts_from_orig = remove_labeled_sections(orig.get('description'))
                for k, v in parts_from_orig.items():
                    if not parts.get(k) and v:
                        parts[k] = v
            # prefer using dedicated fields from orig when available
            fabric_comp = normalize_text(orig.get('fabric_composition'))
            care_guide = normalize_text(orig.get('care_guide'))
            if not parts.get('fabric_composition') and fabric_comp:
                parts['fabric_composition'] = fabric_comp
            if not parts.get('care_instructions') and care_guide:
                parts['care_instructions'] = care_guide
            # extract fit from orig description if available
            if not parts.get('fit'):
                od = orig.get('description')
                if od:
                    _, extra = remove_labeled_sections(od)
                    if extra.get('fit'):
                        parts['fit'] = extra.get('fit')
            # images
            images = make_image_objs(prod.get('images') or [])
            if not images:
                # fallback to orig images array
                orig_imgs = orig.get('images') or []
                imgs = []
                for im in orig_imgs:
                    if isinstance(im, str):
                        imgs.append(im)
                    elif isinstance(im, dict):
                        imgs.append(im.get('url') or im.get('src') or im.get('image_url'))
                images = make_image_objs(imgs)
            # prices
            actual_price, sale_price, currency = normalize_price(orig)
            if actual_price is None:
                actual_price, sale_price, currency = normalize_price_from_expanded(prod)
            elif sale_price is None:
                expanded_actual, expanded_sale, _ = normalize_price_from_expanded(prod)
                if expanded_sale is not None:
                    actual_price = expanded_actual
                    sale_price = expanded_sale
            # variants
            variants, sizes, variant_colors = normalize_variants(prod, orig, actual_price, sale_price)
            # ensure at least one size/variant per rules
            if not sizes and orig.get('size_guide_text'):
                sizes = parse_size_guide_sizes(orig.get('size_guide_text'))
            colors = prod.get('colors') or variant_colors or None
            # build broady object
            broady = {
                'external_product_id': ext_id,
                'external_source': 'scraper',
                'brand_name': orig.get('brand_name') or 'Outfitters',
                'title': title,
                'slug': slug,
                'short_description': (description.split('. ')[0] + '.') if description else None,
                'description': description,
                'gender': orig.get('gender') or coll_gender,
                'category': orig.get('category') or 'Clothing',
                'subcategory': orig.get('subcategory') or coll_collection,
                'product_type': orig.get('product_type') or prod.get('product_type'),
                'fit': parts.get('fit'),
                'season': None,
                'collection': coll_collection,
                'product_url': product_url,
                'actual_price': actual_price,
                'sale_price': sale_price,
                'currency': currency,
                'label': None,
                'colors': colors,
                'sizes': sizes if sizes else None,
                'variants': variants if variants else None,
                'images': images if images else None,
                'size_guide': {'details': orig.get('size_guide_text').splitlines()} if orig.get('size_guide_text') else None,
                'shipping_delivery': {
                    'estimatedDeliveryTime': normalize_text(orig.get('delivery_text')) or None,
                    'regions': ['Pakistan'],
                    'charges': None
                },
                'deliveries_returns': {
                    'returnPolicy': normalize_text(orig.get('return_exchange_policy'))
                },
                'fabric_care': {
                    'fabricType': parts.get('fabric_composition') or fabric_comp,
                    'careInstructions': [l.strip() for l in (parts.get('care_instructions') or care_guide or '').splitlines() if l.strip()]
                },
                'detail': {
                    'fitDetails': parts.get('fit'),
                    'fabricComposition': parts.get('fabric_composition') or fabric_comp,
                    'careGuide': parts.get('care_instructions') or care_guide,
                    'sizeGuideText': orig.get('size_guide_text'),
                    'returnExchangePolicy': normalize_text(orig.get('return_exchange_policy')),
                    'disclaimer': normalize_text(orig.get('disclaimer')),
                    'modelDetails': parts.get('model_details'),
                    'materialDetails': None,
                    'origin': None,
                    'packageIncludes': None
                },
                'seo': {
                    'metaTitle': orig.get('meta_title'),
                    'metaDescription': orig.get('meta_description'),
                    'canonicalUrl': orig.get('canonical_url'),
                    'ogImageUrl': images[0]['url'] if images else None
                },
                'additional_info': None,
                'raw': {
                    'sourceUrl': product_url,
                    'sourceCollectionUrl': coll.get('collection_url'),
                    'scrapedAt': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'originalProductJson': orig,
                    'expandedScrape': prod
                }
            }
            # cleanup emptys
            broady['shipping_delivery'] = clean_dict(broady.get('shipping_delivery'))
            broady['deliveries_returns'] = clean_dict(broady.get('deliveries_returns'))
            broady['fabric_care'] = clean_dict(broady.get('fabric_care'))
            broady['detail'] = clean_dict(broady.get('detail'))
            broady['seo'] = clean_dict(broady.get('seo'))
            for k in ['sizes','variants','images','size_guide','fabric_care','detail','seo','shipping_delivery','deliveries_returns']:
                if not broady.get(k):
                    broady.pop(k, None)
            out.append(broady)
    OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
    print('Wrote', OUT_PATH)
