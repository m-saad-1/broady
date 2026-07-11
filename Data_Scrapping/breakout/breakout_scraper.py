from __future__ import annotations

import json
import re
import time
from collections import defaultdict, OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.breakout.com.pk"
BRAND_NAME = "Breakout"
BRAND_ID = "brand_breakout"
OUTPUT_DIR = Path(__file__).resolve().parent
NORMALIZED_OUT = OUTPUT_DIR / "breakout_broady.json"
EXPANDED_OUT = OUTPUT_DIR / "breakout_expanded.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; BroadyScraper/1.0; +https://broady.local)"
}

SITE_SHIPPING = {
    "estimatedDeliveryTime": "4-5 working days",
    "deliveryText": "Order delivery time: 4-5 working days",
    "charges": "Flat Shipping 99 PKR + FBR POS Fee 1 PKR",
    "codAvailable": True,
    "regions": ["Pakistan"],
}

SITE_RETURNS = {
    "returnPolicy": (
        "Exchange within 7 days of purchase; no refunds or returns; "
        "sale items can be exchanged only for a different size, subject to availability; "
        "international orders are not eligible."
    ),
    "refundConditions": "No refunds. Exchange only, subject to policy restrictions.",
}

SEGMENT_COLLECTIONS = {
    "men": [
        "men-new-in",
        "men-shoes",
        "accessories-men",
        "men-wallets",
        "men-belts",
    ],
    "women": [
        "women-new-in",
        "women-shoes",
        "women-bags",
        "women-accessories-ws25",
        "women-wallets",
    ],
    "boys": [
        "boys-newin",
        "boy-accessories-shoes",
        "boys-accessories",
        "boys-1-5-new-in",
    ],
    "girls": [
        "girls-new-in",
        "girls-accessories-shoes",
        "girls-caps",
        "girls-character",
        "girls-flat-30",
        "girls-pant",
    ],
}

TARGET_BASE_HANDLES = {
    "men": [
        "6dshp688",
        "6dsfw697",
        "6dsst694",
        "6dshp808",
        "6dshp806",
        "6dsmd696",
        "6dsmt801",
        "6dsms805",
        "6assh137",
        "6dsbl995",
        "6dswl994",
        "6bsbg050",
    ],
    "women": [
        "6dswt903",
        "6dswt902",
        "6dsnt799",
        "6dswt790",
        "6dswp902",
        "6dswd778",
        "6dswd777",
        "6cssh901",
        "6cssh952",
        "6csbg129",
        "6cssf122",
        "6aswl070",
    ],
    "boys": [
        "k6est811",
        "k6est696",
        "k6esp809",
        "k6esw806",
        "k6esw801",
        "k6dsd687",
        "k6dsb688",
        "k6dsb685",
        "k6dsb686",
        "k6assh77",
        "k6asbc65",
        "k6asbw17",
    ],
    "girls": [
        "k6dsw725",
        "k6dsw738",
        "k6dst730",
        "k6dst717",
        "k6dsd723",
        "k6dsb719",
        "k6dsb715",
        "k6assh70",
        "k6assh83",
        "k6asgc49",
        "k6asbg09",
        "k6asgw44",
    ],
}

SEGMENT_LABELS = {
    "men": "Men",
    "women": "Women",
    "boys": "Boys",
    "girls": "Girls",
}

session = requests.Session()
session.headers.update(HEADERS)

_json_cache: Dict[str, dict] = {}
_html_cache: Dict[str, str] = {}
_collection_cache: Dict[str, list] = {}


def request_json(url: str, retries: int = 3, sleep_s: float = 0.9) -> dict:
    if url in _json_cache:
        return _json_cache[url]
    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            _json_cache[url] = data
            return data
        except Exception as exc:  # pragma: no cover - network dependent
            last_error = exc
            time.sleep(sleep_s * (attempt + 1))
    raise last_error  # type: ignore[misc]


def request_html(url: str, retries: int = 3, sleep_s: float = 0.9) -> str:
    if url in _html_cache:
        return _html_cache[url]
    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            _html_cache[url] = response.text
            return response.text
        except Exception as exc:  # pragma: no cover - network dependent
            last_error = exc
            time.sleep(sleep_s * (attempt + 1))
    raise last_error  # type: ignore[misc]


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def title_case(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = re.sub(r"\s+", " ", value).strip().lower()
    if not text:
        return None
    return " ".join(part.capitalize() if part not in {"t-shirt", "tshirts"} else "T-Shirt" for part in text.split(" "))


def compact_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def normalize_currency_amount(raw_value) -> Optional[float]:
    if raw_value is None:
        return None
    try:
        num = float(raw_value)
    except Exception:
        return None
    if num >= 1000 and float(int(num)) == num:
        return round(num / 100.0, 2)
    return round(num, 2)


def is_material_text(text: str) -> bool:
    lowered = text.lower()
    material_words = [
        "cotton",
        "polyester",
        "faux leather",
        "leather",
        "thermoplastic",
        "rubber",
        "blend",
        "viscose",
        "nylon",
        "linen",
        "denim",
        "spandex",
        "acrylic",
        "wool",
        "mesh",
        "woven",
        "knit",
        "polyurethane",
    ]
    if re.match(r"^\d+(\.\d+)?%\s*", lowered):
        return True
    return any(word in lowered for word in material_words)


def parse_product_body_html(body_html: Optional[str]) -> Dict[str, object]:
    if not body_html:
        return {
            "description": None,
            "material_lines": [],
            "narrative_lines": [],
        }

    soup = BeautifulSoup(body_html, "lxml")
    paragraphs = [compact_text(p.get_text(" ", strip=True)) for p in soup.find_all("p")]
    paragraphs = [p for p in paragraphs if p]

    narrative: List[str] = []
    material_lines: List[str] = []
    for para in paragraphs:
        if is_material_text(para):
            material_lines.append(para)
        else:
            narrative.append(para)

    description = "\n".join(narrative).strip() if narrative else None
    if not description and paragraphs:
        description = paragraphs[0]
        if paragraphs[0] not in material_lines and is_material_text(paragraphs[0]):
            material_lines.insert(0, paragraphs[0])

    return {
        "description": description,
        "material_lines": material_lines,
        "narrative_lines": narrative,
    }


def get_collection_products(handle: str) -> list:
    if handle in _collection_cache:
        return _collection_cache[handle]
    url = f"{BASE_URL}/collections/{handle}/products.json?limit=250"
    data = request_json(url)
    products = data.get("products", [])
    _collection_cache[handle] = products
    return products


def base_handle(product_handle: str) -> str:
    return product_handle.rsplit("-", 1)[0] if "-" in product_handle else product_handle


def normalize_color(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = compact_text(value)
    if not text:
        return None
    mapping = {
        "wht": "White",
        "whi": "White",
        "who": "White",
        "owh": "Off White",
        "ofw": "Off White",
        "blk": "Black",
        "bge": "Beige",
        "be": "Beige",
        "brn": "Brown",
        "bro": "Brown",
        "brow": "Brown",
        "nvy": "Navy",
        "gry": "Grey",
        "gry2": "Grey",
        "lgy": "Light Grey",
        "lgr": "Light Green",
        "olv": "Olive",
        "khk": "Khaki",
        "cml": "Camel",
        "chr": "Charcoal",
        "stn": "Stone",
        "snd": "Sand",
        "red": "Red",
        "blu": "Blue",
        "lbu": "Light Blue",
        "dbl": "Dark Blue",
        "pnk": "Pink",
        "org": "Orange",
        "yel": "Yellow",
        "grn": "Green",
        "gn": "Green",
        "msd": "Mustard",
        "rwt": "Rust White",
        "rto": "Rust",
        "bur": "Burgundy",
        "bge": "Beige",
        "mul": "Multi",
        "mlt": "Multi",
    }
    key = text.lower().replace(" ", "").replace("&", "")
    if key in mapping:
        return mapping[key]
    if text.isupper() and len(text) <= 6:
        return text.title()
    return " ".join(word.capitalize() for word in text.split())


def extract_fit(title: str, narrative_text: str) -> Optional[str]:
    haystack = f"{title} {narrative_text}".lower()
    patterns = [
        (r"relaxed fit", "Relaxed Fit"),
        (r"regular fit", "Regular Fit"),
        (r"slim fit", "Slim Fit"),
        (r"oversized", "Oversized"),
        (r"boxy fit", "Boxy Fit"),
        (r"straight fit", "Straight Fit"),
        (r"baggy fit", "Baggy Fit"),
        (r"loose fit", "Loose Fit"),
        (r"wide leg", "Wide Leg"),
        (r"flared fit", "Flared Fit"),
        (r"fitted", "Fitted"),
        (r"jogger", "Jogger"),
    ]
    for pattern, value in patterns:
        if re.search(pattern, haystack):
            return value
    return None


def extract_sub_type(title: str, category: str) -> Tuple[Optional[str], Optional[str]]:
    lowered = title.lower()
    if category == "shirt":
        if any(k in lowered for k in ["printed", "print", "graphic", "slogan"]):
            return "printed", "explicit"
        if any(k in lowered for k in ["knit", "mesh"]):
            return "knit", "explicit"
        if any(k in lowered for k in ["textured", "dobby", "seersucker", "jacquard"]):
            return "textured", "explicit"
        if "denim" in lowered:
            return "denim", "explicit"
        if "flannel" in lowered:
            return "flannel", "explicit"
        if "linen" in lowered:
            return "linen", "explicit"
        if any(k in lowered for k in ["formal", "oxford"]):
            return "formal", "explicit"
        if any(k in lowered for k in ["casual", "button down", "resort collar"]):
            return "casual", "explicit"
    if category == "polo":
        if "striped" in lowered:
            return "striped", "explicit"
        if any(k in lowered for k in ["printed", "print", "graphic"]):
            return "printed", "explicit"
        if any(k in lowered for k in ["textured", "mesh", "knit"]):
            return "basic", "inferred"
        return "basic", "inferred"
    if category == "t-shirt":
        if "oversized" in lowered:
            return "oversized", "explicit"
        if "graphic" in lowered:
            return "graphic", "explicit"
        if "printed" in lowered or "print" in lowered:
            return "printed", "explicit"
        if "striped" in lowered:
            return "striped", "explicit"
        if "basic" in lowered:
            return "basic", "explicit"
        return "basic", "inferred"
    if category == "sneaker":
        if "chunky" in lowered:
            return "chunky", "explicit"
        if "running" in lowered:
            return "running", "explicit"
    return None, None


def map_category_and_division(title: str) -> Tuple[str, str, str, str]:
    lowered = title.lower()

    footwear_map = [
        ("trainer", "trainer", "Trainer", "Trainers"),
        ("trainers", "trainer", "Trainer", "Trainers"),
        ("sneaker", "sneaker", "Sneaker", "Sneaker"),
        ("sneakers", "sneaker", "Sneaker", "Sneaker"),
        ("loafer", "loafer", "Loafer", "Loafers"),
        ("loafers", "loafer", "Loafer", "Loafers"),
        ("sandals", "sandal", "Sandal", "Sandals"),
        ("sandal", "sandal", "Sandal", "Sandals"),
        ("boot", "boot", "Boot", "Boots"),
        ("pumps", "formal_shoe", "Formal Shoe", "Shoes"),
        ("heel", "formal_shoe", "Formal Shoe", "Shoes"),
        ("mule", "open_shoe", "Open Shoe", "Shoes"),
        ("flats", "closed_shoe", "Closed Shoe", "Shoes"),
        ("flat", "closed_shoe", "Closed Shoe", "Shoes"),
    ]
    for keyword, category, product_type, subcategory in footwear_map:
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            return "footwear", category, product_type, subcategory

    top_map = [
        ("polo", "polo", "Polo", "Polos"),
        ("t-shirt", "t-shirt", "T-Shirt", "T-Shirts"),
        ("tee", "t-shirt", "T-Shirt", "T-Shirts"),
        ("shirt", "shirt", "Shirt", "Shirts"),
        ("top", "top", "Top", "Tops"),
        ("blouse", "top", "Top", "Tops"),
        ("tank", "top", "Top", "Tops"),
        ("kimono", "top", "Top", "Tops"),
        ("dress", "top", "Top", "Dresses"),
        ("frock", "top", "Top", "Dresses"),
        ("jumpsuit", "top", "Top", "Dresses"),
        ("co-ord", "top", "Top", "Co-ords"),
    ]
    for keyword, category, product_type, subcategory in top_map:
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            return "top", category, product_type, subcategory

    bottom_map = [
        ("jogger", "jogger", "Jogger", "Joggers"),
        ("cargo", "cargo", "Cargo Pants", "Cargo Pants"),
        ("shorts", "shorts", "Shorts", "Shorts"),
        ("short", "shorts", "Shorts", "Shorts"),
        ("skirt", "skirt", "Skirt", "Skirts"),
        ("denim", "jeans", "Jeans", "Jeans"),
        ("jean", "jeans", "Jeans", "Jeans"),
        ("jeggings", "jeans", "Jeans", "Jeans"),
        ("trouser", "trouser", "Trouser", "Trousers"),
        ("pant", "trouser", "Trouser", "Trousers"),
        ("bottom", "trouser", "Trouser", "Trousers"),
    ]
    for keyword, category, product_type, subcategory in bottom_map:
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            return "bottom", category, product_type, subcategory

    accessory_map = [
        ("wallet", "wallet", "Wallet", "Wallets"),
        ("belt", "belt", "Belt", "Belts"),
        ("cap", "cap", "Cap", "Caps"),
        ("hat", "cap", "Cap", "Caps"),
        ("sock", "socks", "Socks", "Socks"),
        ("sunglass", "sunglasses", "Sunglasses", "Sunglasses"),
        ("scarf", "scarf", "Scarf", "Scarves"),
        ("watch", "watch", "Watch", "Watches"),
        ("bag", "bag", "Bag", "Bags"),
        ("backpack", "bag", "Bag", "Bags"),
        ("bracelet", "jewellery", "Jewellery", "Jewellery"),
        ("necklace", "jewellery", "Jewellery", "Jewellery"),
        ("ring", "jewellery", "Jewellery", "Jewellery"),
        ("earring", "jewellery", "Jewellery", "Jewellery"),
        ("jewel", "jewellery", "Jewellery", "Jewellery"),
    ]
    for keyword, category, product_type, subcategory in accessory_map:
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            return "accessory", category, product_type, subcategory

    return "top", "top", "Top", "Tops"


def resolve_color_from_entry(entry: dict, product_json: dict) -> Optional[str]:
    options = product_json.get("options") or []
    for opt in options:
        name = str(opt.get("name") or "").lower()
        if "color" in name or "colour" in name:
            values = opt.get("values") or []
            if values:
                return normalize_color(values[0])
    handle = entry.get("handle") or ""
    suffix = handle.rsplit("-", 1)[-1] if "-" in handle else None
    return normalize_color(suffix)


def parse_page_context(product_url: str, segment: str, category: str, subcategory: str, title: str, sub_type: Optional[str]) -> dict:
    url_segments = [part for part in re.split(r"/+", product_url.split("://", 1)[-1].split("/", 1)[-1]) if part]
    return {
        "scrape_url": product_url,
        "url_segments": url_segments,
        "breadcrumb_raw": [SEGMENT_LABELS[segment], subcategory, title],
        "gender_raw": SEGMENT_LABELS[segment],
        "category_raw": subcategory,
        "sub_type_raw": sub_type.title() if sub_type else None,
        "resolved_gender": segment,
        "resolved_division": map_category_and_division(title)[0],
        "resolved_category": category,
        "resolved_sub_type": sub_type,
        "resolution_source": "adapter_label",
    }


def extract_model_and_disclaimer(page_lines: List[str], title: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    model = None
    disclaimer_parts: List[str] = []
    price_note = None
    for line in page_lines:
        lowered = line.lower()
        if "model height" in lowered or "model is wearing" in lowered or "model wears" in lowered:
            model = line
        if "actual colour of the product may vary" in lowered or "actual color of the product may vary" in lowered:
            disclaimer_parts.append(line)
        if "price may vary according to size" in lowered:
            price_note = line
    if price_note:
        disclaimer_parts.append(price_note)
    disclaimer = " ".join(dict.fromkeys(disclaimer_parts)) if disclaimer_parts else None
    return model, disclaimer, price_note


def extract_section_text(page_lines: List[str], section_label: str, stop_labels: Iterable[str], title: str) -> List[str]:
    try:
        start_idx = next(i for i, line in enumerate(page_lines) if line.strip().lower() == section_label.lower())
    except StopIteration:
        return []

    stop_set = {s.lower() for s in stop_labels}
    collected: List[str] = []
    for line in page_lines[start_idx + 1 :]:
        lower = line.strip().lower()
        if not lower:
            continue
        if lower == title.lower():
            break
        if lower in stop_set:
            break
        if lower in {"follow us", "search", "view cart", "checkout", "quantity"}:
            break
        if lower in {"size", "color", "colour"}:
            break
        if re.match(r"^(men|women|boys|girls)$", lower):
            break
        collected.append(line.strip())
    return collected


def collect_page_lines(html: str) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    return [line.strip() for line in soup.get_text("\n").splitlines() if line.strip()]


def parse_season(tags: List[str]) -> Optional[str]:
    joined = " ".join(tags).lower()
    if "26-sum" in joined or "summer '26" in joined or "summer 26" in joined:
        return "SS-26"
    if "25-winter" in joined or "winter '25" in joined:
        return "FW-25"
    if "spring '26" in joined:
        return "SS-26"
    return None


def normalize_labelled_lookup(value: Optional[str]) -> Optional[str]:
    return compact_text(value)


def build_selection_index() -> Dict[str, dict]:
    index: Dict[str, dict] = {}
    for segment, collection_handles in SEGMENT_COLLECTIONS.items():
        for collection_handle in collection_handles:
            for entry in get_collection_products(collection_handle):
                handle = entry.get("handle")
                if not handle:
                    continue
                base = base_handle(handle)
                bucket = index.setdefault(
                    base,
                    {
                        "segment": segment,
                        "collection_handles": [],
                        "entries": [],
                        "collection_titles": [],
                    },
                )
                bucket["entries"].append(entry)
                bucket["collection_handles"].append(collection_handle)
    for base, bucket in index.items():
        bucket["collection_handles"] = list(dict.fromkeys(bucket["collection_handles"]))
        bucket["entries"] = sorted(bucket["entries"], key=lambda item: item.get("handle") or "")
    return index


def build_product_family(base: str, bucket: dict, segment: str) -> Optional[dict]:
    entries = bucket["entries"]
    if not entries:
        return None

    handle_to_entry = {entry.get("handle"): entry for entry in entries if entry.get("handle")}
    handle_urls = [f"{BASE_URL}/products/{handle}" for handle in handle_to_entry]
    representative_handle = TARGET_BASE_HANDLES[segment].index(base) if base in TARGET_BASE_HANDLES[segment] else 0
    representative_entry = entries[0]
    rep_handle = representative_entry["handle"]
    rep_url = f"{BASE_URL}/products/{rep_handle}"

    product_sources = []
    all_variants = []
    all_images = []
    all_colors: List[str] = []
    all_sizes: List[str] = []
    title = None
    body_html = None
    tags: List[str] = []
    season_tags: List[str] = []
    vendor = BRAND_NAME
    product_type_source = None
    compare_price_values: List[float] = []
    current_price_values: List[float] = []
    canonical_collection_label = None

    for handle, entry in handle_to_entry.items():
        product_url = f"{BASE_URL}/products/{handle}"
        product_json = request_json(f"{product_url}.js")
        html = request_html(product_url)
        lines = collect_page_lines(html)

        if title is None:
            title = compact_text(product_json.get("title")) or compact_text(entry.get("title"))
        if body_html is None:
            body_html = product_json.get("description")
        if not tags:
            tags = list(product_json.get("tags") or [])
        if not vendor:
            vendor = compact_text(product_json.get("vendor")) or BRAND_NAME
        if not product_type_source:
            product_type_source = compact_text(product_json.get("type"))
        if canonical_collection_label is None:
            canonical_collection_label = bucket["collection_handles"][0]

        parsed_body = parse_product_body_html(product_json.get("description"))
        color_name = resolve_color_from_entry(entry, product_json)
        if color_name and color_name not in all_colors:
            all_colors.append(color_name)

        size_values = []
        color_values = []
        options = product_json.get("options") or []
        for opt in options:
            opt_name = str(opt.get("name") or "").lower()
            values = opt.get("values") or []
            if "size" in opt_name:
                size_values.extend([compact_text(v) for v in values if compact_text(v)])
            if "color" in opt_name or "colour" in opt_name:
                color_values.extend([normalize_color(v) for v in values if normalize_color(v)])
        for size in size_values:
            if size and size not in all_sizes:
                all_sizes.append(size)

        price = normalize_currency_amount(product_json.get("price"))
        compare_at = normalize_currency_amount(product_json.get("compare_at_price"))
        if price is not None:
            current_price_values.append(price)
        if compare_at is not None:
            compare_price_values.append(compare_at)

        for variant in product_json.get("variants") or []:
            variant_size = compact_text(variant.get("option1")) or compact_text(variant.get("option2")) or compact_text(variant.get("title"))
            variant_color = normalize_color(variant.get("option2")) if variant.get("option2") else color_name
            if not variant_color:
                variant_color = color_name
            variant_price = normalize_currency_amount(variant.get("price"))
            variant_compare = normalize_currency_amount(variant.get("compare_at_price")) or compare_at
            stock_qty = variant.get("inventory_quantity")
            if isinstance(stock_qty, str) and stock_qty.isdigit():
                stock_qty = int(stock_qty)
            if not isinstance(stock_qty, int):
                stock_qty = None
            available = bool(variant.get("available"))
            if available and stock_qty is not None and stock_qty <= 0:
                available = False
            stock_status = "out_of_stock"
            if available:
                if stock_qty is not None and stock_qty <= 5:
                    stock_status = "low_stock"
                else:
                    stock_status = "in_stock"
            sku = compact_text(variant.get("sku")) or f"{base}-{handle}-{variant_size or 'OS'}"
            variant_id = compact_text(str(variant.get("id"))) or f"{base}-{handle}-{variant_size or 'OS'}"
            all_variants.append(
                {
                    "variant_id": f"broady_var_{variant_id}",
                    "externalVariantId": variant_id,
                    "external_variant_id": variant_id,
                    "sku": sku,
                    "barcode": compact_text(variant.get("barcode")),
                    "color_name": variant_color,
                    "color": variant_color,
                    "size": variant_size,
                    "fit": extract_fit(title or "", parsed_body.get("description") or ""),
                    "price": variant_price if variant_price is not None else price,
                    "pricePkr": variant_price if variant_price is not None else price,
                    "salePricePkr": variant_price if compare_at and variant_price and compare_at > variant_price else None,
                    "compareAtPricePkr": variant_compare,
                    "compare_at_price": variant_compare,
                    "stock_quantity": stock_qty,
                    "quantity": stock_qty,
                    "stock_status": stock_status,
                    "is_available": available,
                    "isActive": available,
                    "option1": variant_color,
                    "option2": variant_size,
                }
            )

        # Preserve image order across all colors.
        for idx, image_url in enumerate(product_json.get("images") or []):
            absolute = image_url if image_url.startswith("http") else f"https:{image_url}"
            all_images.append(
                {
                    "sourceUrl": absolute,
                    "url": absolute,
                    "altText": f"{title or handle} {color_name or ''}".strip(),
                    "imageType": "main" if idx == 0 else "gallery",
                    "isPrimary": idx == 0,
                    "sortOrder": len(all_images),
                }
            )

        product_sources.append(
            {
                "handle": handle,
                "product_url": product_url,
                "product_json": {
                    "id": product_json.get("id"),
                    "title": product_json.get("title"),
                    "handle": product_json.get("handle"),
                    "vendor": product_json.get("vendor"),
                    "type": product_json.get("type"),
                    "tags": product_json.get("tags"),
                    "options": product_json.get("options"),
                    "variants": product_json.get("variants"),
                    "images": product_json.get("images"),
                    "price": product_json.get("price"),
                    "compare_at_price": product_json.get("compare_at_price"),
                    "available": product_json.get("available"),
                },
                "page_lines": lines,
                "parsed_body": parsed_body,
            }
        )

    if not title:
        return None

    unique_images = []
    seen_urls = set()
    for image in all_images:
        if image["url"] in seen_urls:
            continue
        seen_urls.add(image["url"])
        unique_images.append(image)

    unique_variants = []
    seen_variant_ids = set()
    for variant in all_variants:
        key = variant["external_variant_id"]
        if key in seen_variant_ids:
            continue
        seen_variant_ids.add(key)
        unique_variants.append(variant)

    description_parts = []
    material_parts = []
    narrative_parts = []
    model_details = None
    disclaimer = None
    price_note = None

    first_source = product_sources[0]
    narrative = first_source["parsed_body"].get("description")
    if narrative:
        narrative_parts = [line for line in str(narrative).split("\n") if line.strip()]
    material_parts = list(dict.fromkeys(
        [line for source in product_sources for line in source["parsed_body"].get("material_lines", []) if line]
    ))
    description_parts.extend(narrative_parts)

    for source in product_sources:
        model, source_disclaimer, source_price_note = extract_model_and_disclaimer(source["page_lines"], title)
        if model and not model_details:
            model_details = model
        if source_disclaimer:
            disclaimer = source_disclaimer if not disclaimer else f"{disclaimer} {source_disclaimer}"
        if source_price_note:
            price_note = source_price_note

    if not description_parts and material_parts:
        description_parts = material_parts[:1]

    description = "\n".join(dict.fromkeys(description_parts)).strip() if description_parts else None
    short_description = None
    if description:
        short_description = description.split(".")[0].strip()
        if short_description and not short_description.endswith(".") and "." in description:
            short_description += "."
        if short_description == description:
            short_description = description[:140].strip()

    title_text = title_case(title) or title
    title_lower = title.lower()
    division, category, product_type, subcategory = map_category_and_division(title)
    sub_type, sub_type_confidence = extract_sub_type(title, category)
    fit = extract_fit(title, description or "")

    resolved_status = "complete"
    if category in {"shirt", "polo", "t-shirt", "sneaker"} and not sub_type:
        resolved_status = "partial"

    actual_price = None
    sale_price = None
    if compare_price_values and current_price_values:
        actual_price = max(compare_price_values) if max(compare_price_values) > max(current_price_values) else max(current_price_values)
        sale_price = min(current_price_values) if max(compare_price_values) > max(current_price_values) else None
    elif current_price_values:
        actual_price = max(current_price_values)
    elif compare_price_values:
        actual_price = max(compare_price_values)

    price_min = min([v for v in current_price_values if v is not None], default=None)
    price_max = max([v for v in current_price_values if v is not None], default=None)
    if sale_price is None and price_min is not None and price_max is not None and price_min != price_max:
        sale_price = price_min
        actual_price = price_max

    if actual_price is None:
        actual_price = price_min

    stock_counts = [v for v in unique_variants if v.get("is_available")]
    stock_summary = {
        "status": "out_of_stock",
        "availableVariantCount": len(stock_counts),
        "totalVariantCount": len(unique_variants),
        "availableSizes": list(dict.fromkeys([v.get("size") for v in unique_variants if v.get("is_available") and v.get("size")])),
        "availableColors": list(dict.fromkeys([v.get("color_name") for v in unique_variants if v.get("is_available") and v.get("color_name")])),
    }
    if stock_summary["availableVariantCount"] > 0:
        stock_summary["status"] = "low_stock" if any(v.get("stock_status") == "low_stock" for v in unique_variants) else "in_stock"

    tags = list(dict.fromkeys([t for t in tags if t])) if tags else []
    if SEGMENT_LABELS[segment].upper() not in [t.upper() for t in tags]:
        tags.append(SEGMENT_LABELS[segment])
    if subcategory and subcategory not in tags:
        tags.append(subcategory)
    if category and category not in tags:
        tags.append(category)

    season = parse_season(tags)
    label = "Sale" if sale_price is not None and actual_price is not None and sale_price < actual_price else None
    if not label and any(str(tag).lower() == "new" for tag in tags):
        label = "New"

    meta_title = None
    meta_description = None
    canonical_url = None
    og_image = unique_images[0]["url"] if unique_images else None
    try:
        html = request_html(rep_url)
        soup = BeautifulSoup(html, "lxml")
        meta_title_tag = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "title"})
        meta_desc_tag = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "description"})
        canonical_tag = soup.find("link", rel="canonical")
        og_image_tag = soup.find("meta", property="og:image")
        if meta_title_tag and meta_title_tag.get("content"):
            meta_title = compact_text(meta_title_tag.get("content"))
        if meta_desc_tag and meta_desc_tag.get("content"):
            meta_description = compact_text(meta_desc_tag.get("content"))
        if canonical_tag and canonical_tag.get("href"):
            canonical_url = canonical_tag.get("href")
        if og_image_tag and og_image_tag.get("content"):
            og_image = og_image_tag.get("content")
    except Exception:
        pass

    if disclaimer:
        disclaimer = compact_text(disclaimer)
    if price_note and price_note not in (disclaimer or ""):
        disclaimer = f"{disclaimer} {price_note}".strip() if disclaimer else price_note

    if material_parts:
        fabric_type = "; ".join(dict.fromkeys(material_parts))
    else:
        fabric_type = None

    care_lines = []
    for source in product_sources:
        lines = source["page_lines"]
        care_section = extract_section_text(
            lines,
            "CARE",
            ["TEXTURED", "MATERIAL", "SHIPPING", "RETURN", "EXCHANGE", "MODEL", "DISCLAIMER", "FOLLOW US"],
            title,
        )
        if care_section:
            care_lines.extend(care_section)
    care_lines = [line for line in dict.fromkeys(care_lines) if line]

    material_details = fabric_type
    if product_sources:
        for source in product_sources:
            material_section = extract_section_text(
                source["page_lines"],
                "MATERIAL",
                ["CARE", "SHIPPING", "RETURN", "EXCHANGE", "MODEL", "DISCLAIMER", "FOLLOW US"],
                title,
            )
            if material_section:
                material_details = "; ".join(dict.fromkeys(material_section))
                break

    detail = {
        "fitDetails": fit,
        "fabricComposition": fabric_type,
        "careGuide": "\n".join(care_lines) if care_lines else None,
        "modelDetails": model_details,
        "disclaimer": disclaimer,
        "materialDetails": material_details,
        "origin": None,
        "packageIncludes": None,
        "returnExchangePolicy": SITE_RETURNS["returnPolicy"],
        "sizeGuideText": None,
    }
    detail = {k: v for k, v in detail.items() if v not in (None, [], {})}

    fabric_care = {
        "fabricType": fabric_type,
        "careInstructions": care_lines or None,
    }
    fabric_care = {k: v for k, v in fabric_care.items() if v not in (None, [], {})}

    shipping_delivery = {k: v for k, v in SITE_SHIPPING.items() if v not in (None, [], {})}
    deliveries_returns = {k: v for k, v in SITE_RETURNS.items() if v not in (None, [], {})}
    size_guide = None

    product_url = rep_url
    page_context = parse_page_context(product_url, segment, category, subcategory, title_text or title, sub_type)
    page_context["breadcrumb_raw"] = [SEGMENT_LABELS[segment], subcategory, title_text or title]
    page_context["resolved_division"] = division
    page_context["resolved_category"] = category

    normalized = {
        "id": f"broady_{slugify(title_text or title or base)}",
        "external_product_id": base,
        "external_source": "scraper",
        "brand_id": BRAND_ID,
        "brand_name": BRAND_NAME,
        "title": title_text or title,
        "slug": slugify(title_text or title or base),
        "short_description": short_description,
        "description": description,
        "gender": segment,
        "division": division,
        "category": category,
        "subcategory": subcategory,
        "product_type": product_type,
        "fit": fit,
        "season": season,
        "collection": SEGMENT_LABELS[segment],
        "product_url": product_url,
        "actual_price": actual_price,
        "sale_price": sale_price if sale_price is not None and actual_price is not None and sale_price < actual_price else None,
        "currency": "PKR",
        "label": label,
        "colors": all_colors or None,
        "sizes": all_sizes or None,
        "variants": unique_variants or None,
        "images": unique_images or None,
        "stock": stock_summary,
        "size_guide": size_guide,
        "shipping_delivery": shipping_delivery,
        "deliveries_returns": deliveries_returns,
        "fabric_care": fabric_care,
        "detail": detail,
        "seo": {
            "metaTitle": meta_title,
            "metaDescription": meta_description,
            "canonicalUrl": canonical_url or product_url,
            "ogImageUrl": og_image,
        },
        "additional_info": [
            {
                "label": "Estimated Delivery Time",
                "value": SITE_SHIPPING["estimatedDeliveryTime"],
            }
        ],
        "tags": tags or None,
        "status": "pending",
        "approval_status": "pending",
        "visibility": "hidden",
        "source": "scraper",
        "source_format": "shopify_json",
        "mapping_status": resolved_status,
        "sub_type": sub_type,
        "sub_type_confidence": sub_type_confidence,
        "resolution_source": "adapter_label",
        "page_context": page_context,
        "raw": {
            "sourceUrl": product_url,
            "sourceCollectionUrls": [f"{BASE_URL}/collections/{handle}" for handle in bucket["collection_handles"]],
            "scrapedAt": datetime.now(timezone.utc).isoformat(),
            "baseHandle": base,
            "collectionHandles": bucket["collection_handles"],
            "selectedHandles": list(handle_to_entry.keys()),
            "sourceProducts": product_sources,
            "policyUrls": {
                "shipping": f"{BASE_URL}/policies/shipping-policy",
                "return": f"{BASE_URL}/pages/shipping-and-return",
            },
        },
    }

    normalized = {k: v for k, v in normalized.items() if v not in (None, [], {})}
    normalized["shipping_delivery"] = {k: v for k, v in normalized.get("shipping_delivery", {}).items() if v not in (None, [], {})}
    normalized["deliveries_returns"] = {k: v for k, v in normalized.get("deliveries_returns", {}).items() if v not in (None, [], {})}
    normalized["fabric_care"] = {k: v for k, v in normalized.get("fabric_care", {}).items() if v not in (None, [], {})}
    normalized["detail"] = {k: v for k, v in normalized.get("detail", {}).items() if v not in (None, [], {})}
    normalized["seo"] = {k: v for k, v in normalized.get("seo", {}).items() if v not in (None, [], {})}
    normalized["stock"] = {k: v for k, v in normalized.get("stock", {}).items() if v not in (None, [], {})}

    return normalized


def validate_product(product: dict) -> List[str]:
    errors = []
    if not product.get("title"):
        errors.append("missing title")
    if not product.get("product_url"):
        errors.append("missing product_url")
    if not isinstance(product.get("actual_price"), (int, float)) or product.get("actual_price") <= 0:
        errors.append("missing or invalid actual_price")
    if not product.get("images"):
        errors.append("missing images")
    else:
        for img in product.get("images", []):
            if not str(img.get("url") or img.get("sourceUrl") or "").startswith("http"):
                errors.append("non-absolute image url")
                break
    if not product.get("sizes"):
        errors.append("missing sizes")
    if not product.get("variants"):
        errors.append("missing variants")
    if not product.get("raw"):
        errors.append("missing raw")
    if product.get("sale_price") is not None and product.get("actual_price") is not None:
        if product["sale_price"] >= product["actual_price"]:
            errors.append("sale_price is not lower than actual_price")
    if product.get("description"):
        desc = str(product["description"]).lower()
        if any(keyword in desc for keyword in ["fabric & care", "return", "exchange", "shipping", "size guide", "disclaimer"]):
            errors.append("description contains policy text")
    return errors


def select_segment_products(index: Dict[str, dict], segment: str) -> List[dict]:
    selected = []
    seen = set()
    for base in TARGET_BASE_HANDLES[segment]:
        bucket = index.get(base)
        if not bucket:
            continue
        if base in seen:
            continue
        product = build_product_family(base, bucket, segment)
        if product:
            selected.append(product)
            seen.add(base)
    return selected


def main() -> None:
    index = build_selection_index()
    all_products: List[dict] = []
    expanded: List[dict] = []
    validation_map: Dict[str, List[str]] = {}

    for segment in ["men", "women", "boys", "girls"]:
        products = select_segment_products(index, segment)
        print(f"{segment}: selected {len(products)} products")
        all_products.extend(products)
        expanded.append(
            {
                "segment": segment,
                "collection_handles": SEGMENT_COLLECTIONS[segment],
                "products": [
                    {
                        "external_product_id": item.get("external_product_id"),
                        "title": item.get("title"),
                        "product_url": item.get("product_url"),
                        "gender": item.get("gender"),
                        "division": item.get("division"),
                        "category": item.get("category"),
                        "subcategory": item.get("subcategory"),
                        "product_type": item.get("product_type"),
                        "colors": item.get("colors"),
                        "sizes": item.get("sizes"),
                        "actual_price": item.get("actual_price"),
                        "sale_price": item.get("sale_price"),
                        "images": item.get("images"),
                        "variants": item.get("variants"),
                        "page_context": item.get("page_context"),
                        "mapping_status": item.get("mapping_status"),
                    }
                    for item in products
                ],
            }
        )
        for product in products:
            errors = validate_product(product)
            validation_map[product["external_product_id"]] = errors
            if errors:
                print(f"VALIDATION {product['external_product_id']}: {errors}")

    normalized_counts = defaultdict(int)
    for product in all_products:
        normalized_counts[product.get("gender")] += 1

    if any(count < 10 for count in normalized_counts.values()):
        raise RuntimeError(f"Segment selection too small: {dict(normalized_counts)}")

    NORMALIZED_OUT.write_text(json.dumps(all_products, indent=2, ensure_ascii=False), encoding="utf-8")
    EXPANDED_OUT.write_text(json.dumps(expanded, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote {NORMALIZED_OUT}")
    print(f"Wrote {EXPANDED_OUT}")
    print("Counts:", dict(normalized_counts))

    failed = {k: v for k, v in validation_map.items() if v}
    if failed:
        print("Validation warnings:")
        for key, errors in failed.items():
            print(f" - {key}: {errors}")


if __name__ == "__main__":
    main()
