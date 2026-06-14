import json
import re
import time
import random
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

COLLECTION_URLS = [
    "https://outfitters.com.pk/collections/junior-girls-view-all-collection",
    "https://outfitters.com.pk/collections/toddler-boys-view-all-collection",
    "https://outfitters.com.pk/collections/toddler-girls-view-all-collection",
    "https://outfitters.com.pk/collections/junior-boys-view-all-collection",
]

OUT_PATH = Path("d:/WEB DEVELOPMENT/extract data/outfitters/outfitters_10_per_collection_expanded.json")

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; scraper/1.0; +https://example.com)"}

session = requests.Session()
session.headers.update(HEADERS)


def request_get(url, **kwargs):
    last_error = None
    for attempt in range(4):
        try:
            resp = session.get(url, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            last_error = exc
            time.sleep(1.2 * (attempt + 1))
    raise last_error


def get_product_links(collection_url, limit=10):
    parsed = urlparse(collection_url)
    handle = parsed.path.rstrip("/").split("/")[-1]
    products_json_url = f"{parsed.scheme}://{parsed.netloc}/collections/{handle}/products.json?limit={limit}"
    try:
        resp = request_get(products_json_url, timeout=20)
        data = resp.json()
        links = []
        for product in data.get("products", []):
            product_handle = product.get("handle")
            if product_handle:
                links.append(f"{collection_url.rstrip('/')}/products/{product_handle}")
            if len(links) >= limit:
                break
        if links:
            return links[:limit]
    except Exception:
        pass

    resp = request_get(collection_url, timeout=20)
    soup = BeautifulSoup(resp.text, "lxml")
    links = []
    # collect anchors that point to /products/
    for a in soup.find_all("a", href=True):
        href = a["href"].split("?")[0]
        if "/products/" in href:
            full = urljoin(collection_url, href)
            if full not in links:
                links.append(full)
        if len(links) >= limit:
            break
    return links[:limit]


def extract_text(el):
    return el.get_text(separator=" ", strip=True) if el else None


def extract_price_from_text(text):
    if not text:
        return None
    # find first number-like group
    m = re.search(r"(\d+[\d,]*)", text.replace(',', ''))
    if m:
        try:
            return int(m.group(1))
        except:
            return m.group(1)
    return None


def parse_shopify_price(value):
    if value is None:
        return None
    try:
        num = float(value)
    except Exception:
        return None
    # Shopify .js prices are often in cents
    if num >= 10000:
        return round(num / 100, 2)
    return num


def get_shopify_handle(product_url):
    if not product_url:
        return None
    if "/products/" not in product_url:
        return None
    return product_url.split("/products/")[-1].split("?")[0].strip("/")


def fetch_shopify_json(product_url):
    handle = get_shopify_handle(product_url)
    if not handle:
        return None
    parsed = urlparse(product_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    json_url = f"{base}/products/{handle}.js"
    try:
        resp = request_get(json_url, timeout=20)
        return resp.json()
    except Exception:
        return None


def html_to_text(html):
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator=" ", strip=True)
    return text if text else None


def extract_product(url):
    try:
        resp = request_get(url, timeout=20)
    except Exception as e:
        return {"url": url, "error": str(e)}
    soup = BeautifulSoup(resp.text, "lxml")
    # try Shopify JSON for complete data
    shopify = fetch_shopify_json(url)

    # title
    title = None
    if shopify and shopify.get("title"):
        title = shopify.get("title")
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = extract_text(h1)
    if not title:
        mt = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "title"})
        if mt and mt.get("content"):
            title = mt["content"].strip()

    # images: gather from Shopify first
    images = []
    if shopify and shopify.get("images"):
        for img in shopify.get("images", []):
            if img and img not in images:
                images.append(img)
    # look for common gallery containers
    gallery_selectors = [
        ("div", re.compile(r"product[-_ ]?gallery|product[-_ ]?images|product[-_ ]?photos", re.I)),
        ("ul", re.compile(r"product[-_ ]?gallery|product[-_ ]?images|product[-_ ]?photos", re.I)),
        ("div", re.compile(r"slider|slick|fotorama", re.I)),
    ]
    for tag, pattern in gallery_selectors:
        for container in soup.find_all(tag, class_=pattern):
            for img in container.find_all("img", src=True):
                src = img.get("data-src") or img.get("data-lazy-src") or img.get("src")
                if src:
                    src = urljoin(url, src.split('?')[0])
                    if src not in images:
                        images.append(src)
    # fallback: collect og:image and first few imgs
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        og = og_img.get("content").strip()
        if og not in images:
            images.insert(0, og)
    if not images:
        for img in soup.find_all("img", src=True)[:8]:
            src = urljoin(url, img["src"].split('?')[0])
            if src not in images:
                images.append(src)

    # description: prefer Shopify body_html
    desc_html = None
    desc_text = None
    if shopify and shopify.get("body_html"):
        desc_html = shopify.get("body_html")
        desc_text = html_to_text(desc_html)
    if not desc_text:
        desc_candidates = [
            ("div", re.compile(r"product[-_ ]?description|product[-_ ]?info|product[-_ ]?content|description-box", re.I)),
        ]
        for tag, pattern in desc_candidates:
            el = soup.find(tag, class_=pattern) or soup.find(tag, id=pattern)
            if el:
                desc_html = el.decode_contents()
                desc_text = extract_text(el)
                break
    if not desc_text:
        og_desc = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "description"})
        if og_desc and og_desc.get("content"):
            desc_text = og_desc.get("content").strip()

    # price and sale
    price = None
    sale_price = None
    if shopify and shopify.get("variants"):
        price = parse_shopify_price(shopify["variants"][0].get("price"))
        sale_price = parse_shopify_price(shopify["variants"][0].get("compare_at_price"))
    meta_price = soup.find("meta", property="product:price:amount")
    if meta_price and meta_price.get("content"):
        price = extract_price_from_text(meta_price.get("content"))
    if price is None:
        price_el = soup.find(class_=re.compile("price|product-price|regular-price", re.I))
        if price_el:
            price = extract_price_from_text(extract_text(price_el))
    sale_el = soup.find(class_=re.compile("sale|discount|special-price", re.I))
    if sale_el:
        sale_price = extract_price_from_text(extract_text(sale_el))

    # variants: prefer Shopify JSON
    variants = []
    sizes = []
    colors = []
    options = []
    tags = []
    vendor = None
    product_type = None
    if shopify:
        vendor = shopify.get("vendor")
        product_type = shopify.get("product_type")
        tags = shopify.get("tags") if isinstance(shopify.get("tags"), list) else []
        options = shopify.get("options") if isinstance(shopify.get("options"), list) else []
        for v in shopify.get("variants", []):
            variants.append({
                "id": v.get("id"),
                "sku": v.get("sku"),
                "barcode": v.get("barcode"),
                "option1": v.get("option1"),
                "option2": v.get("option2"),
                "option3": v.get("option3"),
                "price": parse_shopify_price(v.get("price")),
                "compare_at_price": parse_shopify_price(v.get("compare_at_price")),
                "available": v.get("available"),
                "inventory_quantity": v.get("inventory_quantity")
            })
        for opt in options:
            if isinstance(opt, dict):
                name = (opt.get("name") or "").lower()
                values = opt.get("values") or []
                if "size" in name:
                    for val in values:
                        if val not in sizes:
                            sizes.append(val)
                if "color" in name or "colour" in name:
                    for val in values:
                        if val not in colors:
                            colors.append(val)
    # check for script tags with product JSON
    for s in soup.find_all("script", type=re.compile(r"application/(ld\+json|json)")):
        try:
            data = json.loads(s.string or s.text)
        except Exception:
            continue
        # LD+JSON product
        if isinstance(data, dict) and (data.get('@type') == 'Product' or 'offers' in data or 'description' in data):
            # offers may be a list or dict
            try:
                if 'offers' in data and isinstance(data['offers'], list):
                    for off in data['offers']:
                        variants.append({
                            'sku': off.get('sku'),
                            'price': off.get('price') or off.get('priceSpecification', {}).get('price')
                        })
            except Exception:
                pass
    # check for product JSON in script tags (Shopify product JSON)
    if not variants:
        for s in soup.find_all('script'):
            txt = s.string or s.text
            if not txt:
                continue
            m = re.search(r"\{\s*\"variants\"\s*:\s*\[", txt)
            if m:
                # attempt to extract the JSON object around variants
                start = txt.find('{', m.start())
                try:
                    obj = json.loads(txt[start:])
                except Exception:
                    # fallback: try to extract until closing script end (best-effort)
                    continue
                if isinstance(obj, dict) and 'variants' in obj:
                    for v in obj['variants']:
                        variants.append({
                            'id': v.get('id'),
                            'sku': v.get('sku') or v.get('barcode'),
                            'option1': v.get('option1'),
                            'option2': v.get('option2'),
                            'price': v.get('price') or v.get('compare_at_price'),
                            'available': v.get('available') if 'available' in v else None,
                        })
                    break

    # fallback: parse select option elements for sizes/variants
    if not variants:
        for sel in soup.find_all('select'):
            name = sel.get('name','')
            if 'id' in name or 'variant' in name or 'size' in name.lower():
                for opt in sel.find_all('option'):
                    val = opt.get('value')
                    text = opt.get_text(strip=True)
                    variants.append({'id': val, 'label': text})
                    # detect size-like labels
                    if re.search(r"^\d+|XS|S|M|L|XL|XXL|XXS|3T|4T", text, re.I):
                        sizes.append(text)

    variants = variants[:50]
    sizes = list(dict.fromkeys(sizes))

    # external id from url (last path part)
    external_id = url.rstrip("/").split("/")[-1]
    canonical_url = None
    if shopify and shopify.get("handle"):
        parsed = urlparse(url)
        canonical_url = f"{parsed.scheme}://{parsed.netloc}/products/{shopify.get('handle')}"

    return {
        "external_product_id": external_id,
        "title": title,
        "product_url": canonical_url or url,
        "images": images,
        "description_text": desc_text,
        "description_html": desc_html,
        "price": price,
        "sale_price": sale_price,
        "variants": variants,
        "sizes": sizes,
        "colors": colors,
        "options": options,
        "tags": tags,
        "vendor": vendor,
        "product_type": product_type,
        "shopify_json": shopify,
    }


if __name__ == "__main__":
    results = []
    for coll in COLLECTION_URLS:
        print("Fetching:", coll)
        try:
            links = get_product_links(coll, limit=10)
        except Exception as e:
            print("Failed to fetch collection", coll, e)
            links = []
        coll_items = []
        for l in links:
            print("  ->", l)
            item = extract_product(l)
            coll_items.append(item)
            time.sleep(random.uniform(0.6, 1.5))
        results.append({"collection_url": coll, "products": coll_items})
        time.sleep(random.uniform(1.0, 2.0))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
    print("Wrote", OUT_PATH)
