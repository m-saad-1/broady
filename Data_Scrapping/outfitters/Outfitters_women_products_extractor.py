import sys
import json
import re
import time
from datetime import datetime
from bs4 import BeautifulSoup
from curl_cffi import requests

sys.stdout.reconfigure(encoding='utf-8')

COLLECTION_URL = "https://outfitters.com.pk/pages/women-artisanal-collection"
SHOP_URL = "outfitterspk.myshopify.com"
SIZECHART_BE_URL = "https://sizechart-revamp-be.alche.cloud"

def get_product_handles():
    print(f"Fetching Outfitters collection: {COLLECTION_URL}")
    response = requests.get(COLLECTION_URL, impersonate="chrome110")
    if response.status_code != 200:
        print(f"Failed to fetch collection: {response.status_code}")
        return []
        
    soup = BeautifulSoup(response.text, 'html.parser')
    links = [a['href'] for a in soup.find_all('a', href=True) if '/products/' in a['href']]
    handles = list(set(link.split('/products/')[1].split('?')[0] for link in links))
    return handles

def clean_price(val):
    if not val: return None
    try:
        return float(str(val).replace(',', '').strip())
    except:
        return None

def extract_fabric_composition(text):
    match = re.search(r'\b\d+%\s*[A-Za-z]+(?:\s*,\s*\d+%\s*[A-Za-z]+)*\b', text)
    if match:
        return match.group(0).strip()
    return None

def get_outfitters_taxonomy(product_type_field, title):
    pt = product_type_field.lower() if product_type_field else ''
    t = title.lower()
    
    if 'shorts' in pt:
        return 'Shorts', 'Shorts'
    elif 't-shirt' in pt or 'tee' in pt:
        return 'T-Shirts', 'T-Shirt'
    elif 'polo' in pt:
        return 'Polos', 'Polo Shirt'
    elif 'trouser' in pt or 'pant' in pt:
        return 'Trousers', 'Trousers'
    elif 'jean' in pt or 'denim' in pt:
        return 'Jeans', 'Jeans'
    elif 'shirt' in pt:
        return 'Shirts', 'Casual Shirt'
    elif 'top' in pt or 'blouse' in pt:
        return 'Tops', 'Top'
    elif 'kurta' in pt or 'kurtis' in pt or 'ethnic' in pt:
        return 'Ethnic Wear', 'Kurta'
    elif 'dress' in pt or 'jumpsuit' in pt:
        return 'Dresses', 'Dress'
    elif 'skirt' in pt:
        return 'Skirts', 'Skirt'
        
    if 'shorts' in t:
        return 'Shorts', 'Shorts'
    elif 'polo' in t:
        return 'Polos', 'Polo Shirt'
    elif 't-shirt' in t or 'tee' in t:
        return 'T-Shirts', 'T-Shirt'
    elif 'trouser' in t or 'pant' in t:
        return 'Trousers', 'Trousers'
    elif 'jean' in t or 'denim' in t:
        return 'Jeans', 'Jeans'
    elif 'shirt' in t:
        return 'Shirts', 'Casual Shirt'
    elif 'top' in t:
        return 'Tops', 'Top'
    elif 'kurta' in t or 'ethnic' in t:
        return 'Ethnic Wear', 'Kurta'
    elif 'dress' in t or 'jumpsuit' in t:
        return 'Dresses', 'Dress'
    elif 'skirt' in t:
        return 'Skirts', 'Skirt'
        
    return 'Apparel', product_type_field or 'Apparel'

def fetch_size_chart(tag_name):
    url = f"{SIZECHART_BE_URL}/ajax_call_sizechart?shop={SHOP_URL}&tags={tag_name}&format=json"
    try:
        r = requests.get(url, impersonate="chrome110", headers={'Accept': 'application/json'}, timeout=10)
        if r.status_code == 200:
            grid = r.json().get('size_chart', {}).get('grid_sizechart')
            if grid and isinstance(grid, list):
                lines = []
                for row in grid:
                    if isinstance(row, list):
                        lines.append(" | ".join(str(x) for x in row if x is not None))
                return "\n".join(lines)
    except Exception as e:
        print(f"  Error fetching size chart {tag_name}: {e}")
    return ""

def scrape_product(handle):
    json_url = f"https://outfitters.com.pk/products/{handle}.json"
    html_url = f"https://outfitters.com.pk/products/{handle}"
    
    try:
        # 1. Fetch Shopify JSON
        json_res = requests.get(json_url, impersonate="chrome110", timeout=15)
        if json_res.status_code != 200:
            print(f"Failed to fetch JSON for {handle}: {json_res.status_code}")
            return None
        prod_json = json_res.json().get('product')
        if not prod_json: return None
        
        # 2. Fetch live HTML
        html_res = requests.get(html_url, impersonate="chrome110", timeout=15)
        soup = BeautifulSoup(html_res.text, 'html.parser') if html_res.status_code == 200 else None
        
        # 3. Parse availability from HTML JSON-LD
        availability_dict = {}
        if soup:
            for s in soup.find_all('script', type='application/ld+json'):
                try:
                    data = json.loads(s.string)
                    if isinstance(data, dict) and data.get('@type') == 'ProductGroup':
                        for var in data.get('hasVariant', []):
                            var_id_str = var.get('@id', '')
                            v_match = re.search(r'variant=(\d+)', var_id_str)
                            if v_match:
                                v_id = int(v_match.group(1))
                                availability = var.get('offers', {}).get('availability', '')
                                is_in_stock = 'InStock' in availability
                                availability_dict[v_id] = is_in_stock
                except:
                    pass

        # 4. Parse details and shipping from live HTML modals
        details_text = ""
        shipping_text = ""
        if soup:
            for opener in soup.find_all('modal-opener'):
                btn = opener.find('button')
                if btn:
                    btn_text = btn.get_text(strip=True).lower()
                    modal_selector = opener.get('data-modal')
                    if modal_selector:
                        modal_id = modal_selector.replace('#', '')
                        modal = soup.find(id=modal_id)
                        if modal:
                            content = modal.get_text(separator='\n', strip=True)
                            if 'details' in btn_text or 'composition' in btn_text:
                                details_text = content
                            elif 'deliveries' in btn_text or 'returns' in btn_text:
                                shipping_text = content
                                
        # Default description if details_text is empty
        desc = prod_json.get('body_html', '')
        # Clean HTML tags
        desc = BeautifulSoup(desc, 'html.parser').get_text(separator='\n', strip=True) if desc else ''
        
        care_guide = ""
        if details_text:
            if 'Composition & Care' in details_text:
                parts = details_text.split('Composition & Care')
                desc = parts[0].strip()
                care_guide = parts[1].strip()
            elif 'Composition' in details_text:
                parts = details_text.split('Composition')
                desc = parts[0].strip()
                care_guide = parts[1].strip()
            else:
                desc = details_text

        shipping_delivery = "Flat shipping charges of Rs. 298. Delivered in 5-7 working days."
        return_policy = "Exchanges allowed within 14 days of purchase."
        if shipping_text:
            if 'RETURNS:' in shipping_text:
                parts = shipping_text.split('RETURNS:')
                shipping_delivery = parts[0].strip()
                return_policy = parts[1].strip()
            else:
                shipping_delivery = shipping_text
                
        # 5. Extract Size chart dynamically
        size_guide_text = ""
        tags_list = [t.strip() for t in prod_json.get('tags', '').split(',')]
        sizechart_tag = next((t for t in tags_list if 'sizechart' in t.lower() or 'simplified' in t.lower()), None)
        if sizechart_tag:
            size_guide_text = fetch_size_chart(sizechart_tag)
            
        # Clean up any residual SKU prefix in details_text
        if 'Design Code:' in desc:
            desc = desc.split('FIT :')[1] if 'FIT :' in desc else desc
            desc = 'FIT : ' + desc
            
        return {
            'json': prod_json,
            'desc': desc,
            'care_guide': care_guide,
            'shipping_delivery': shipping_delivery,
            'return_policy': return_policy,
            'size_guide_text': size_guide_text,
            'availability_dict': availability_dict,
            'tags': tags_list
        }
    except Exception as e:
        print(f"Error scraping product {handle}: {e}")
        return None

def main():
    handles = get_product_handles()
    print(f"Found {len(handles)} Outfitters product handles.")
    
    broady_products = []
    
    for idx, handle in enumerate(handles):
        print(f"Scraping {idx+1}/{len(handles)}: {handle}")
        data = scrape_product(handle)
        if not data: continue
        
        prod_json = data['json']
        pid = handle
        
        # Determine taxonomy
        subcat, prod_type = get_outfitters_taxonomy(prod_json.get('product_type'), prod_json.get('title'))
        
        # Sibling price estimation
        first_variant = prod_json.get('variants', [{}])[0]
        actual_price = clean_price(first_variant.get('compare_at_price')) or clean_price(first_variant.get('price')) or 0.0
        final_price = clean_price(first_variant.get('price')) or 0.0
        
        discount = 0
        if actual_price > final_price and actual_price > 0:
            discount = round(((actual_price - final_price) / actual_price) * 100)
            
        prod = {
            "id": f"broady_outfitters_{pid}",
            "external_product_id": pid,
            "brand_id": "brand_outfitters",
            "brand_name": "Outfitters",
            "title": prod_json.get('title'),
            "slug": handle,
            "description": data['desc'],
            "gender": "Women",
            "category": "Clothing",
            "subcategory": subcat,
            "product_type": prod_type,
            "status": "active",
            "visibility": "visible",
            "source": "html_scraper",
            "product_url": f"https://outfitters.com.pk/products/{handle}",
            "created_at": prod_json.get('created_at', datetime.utcnow().isoformat()),
            "updated_at": prod_json.get('updated_at', datetime.utcnow().isoformat())
        }
        
        # Flat pricing fields (what Broady normalization.service reads)
        prod["actual_price"]        = actual_price
        prod["sale_price"]          = final_price if discount > 0 else None
        prod["compare_at_price"]    = actual_price
        prod["price"]               = final_price
        prod["currency"]            = "PKR"
        prod["discount_percentage"] = discount
        prod["is_on_sale"]          = discount > 0
        
        # Options mapping
        color_option_index = None
        size_option_index = None
        for opt_idx, opt in enumerate(prod_json.get('options', [])):
            opt_name = opt.get('name', '').lower()
            if 'color' in opt_name or 'colour' in opt_name:
                color_option_index = opt_idx
            elif 'size' in opt_name:
                size_option_index = opt_idx
                
        variants = []
        for var in prod_json.get('variants', []):
            color_name = var.get(f'option{color_option_index + 1}') if color_option_index is not None else 'Default'
            size_name = var.get(f'option{size_option_index + 1}') if size_option_index is not None else 'Standard'
            
            # Variant availability from HTML JSON-LD map, fall back to True
            is_available = data['availability_dict'].get(var.get('id'), True)
            
            v_actual = clean_price(var.get('compare_at_price')) or clean_price(var.get('price')) or actual_price
            v_final = clean_price(var.get('price')) or final_price
            
            variants.append({
                "variant_id": f"broady_var_outfitters_{pid}_{color_name.lower().replace(' ', '_')}_{size_name}",
                "external_variant_id": f"{var.get('id')}",
                "product_id": prod['id'],
                "sku": var.get('sku', ''),
                "barcode": var.get('barcode', ''),
                "color_name": color_name,
                # option1/option2 aliases for Broady normalization
                "option1": color_name,
                "option2": size_name,
                "color": color_name,
                "size": size_name,
                "price": v_final,
                "compare_at_price": v_actual,
                "stock_status": "in_stock" if is_available else "out_of_stock",
                "is_available": is_available,
                # inventory_quantity as a number (required by normalization)
                "inventory_quantity": 10 if is_available else 0
            })
            
        prod["variants"] = variants   # lowercase key for Broady normalization
        
        # Images mapping
        images = []
        for img_idx, img in enumerate(prod_json.get('images', [])):
            img_url = img.get('src').split('?')[0] if img.get('src') else ''
            images.append({
                "image_id": f"img_outfitters_{pid}_{img_idx}",
                "image_url": img_url,
                # 'src' and 'url' aliases for Broady normalization
                "src": img_url,
                "url": img_url,
                "position": img_idx + 1,
                "image_type": "main" if img_idx == 0 else "gallery",
                "product_id": prod['id']
            })
            
        prod["images"] = images   # lowercase key for Broady normalization
        
        # Fabric composition
        fabric = extract_fabric_composition(data['desc']) or extract_fabric_composition(data['care_guide'])
        
        # Flat detail fields (what Broady normalization.service reads)
        prod["fabric_composition"]     = fabric
        prod["care_guide"]             = data['care_guide']
        prod["size_guide_text"]        = data['size_guide_text']
        prod["shipping_delivery"]      = data['shipping_delivery']
        prod["return_exchange_policy"] = data['return_policy']
        prod["disclaimer"]             = "Colors may vary slightly due to photographic lighting or screen settings."
        
        prod["tags"] = data['tags']
        
        # Flat shipping fields
        prod["estimated_delivery_min_days"] = 5
        prod["estimated_delivery_max_days"] = 7
        prod["delivery_text"]               = "Flat shipping charges Rs. 298. Delivered in 5-7 working days."
        prod["cod_available"]               = True
        prod["return_available"]            = True
        prod["exchange_available"]          = True
        
        # Flat SEO fields
        prod["meta_title"]    = prod['title']
        prod["canonical_url"] = f"https://outfitters.com.pk/products/{handle}"
        
        broady_products.append(prod)
        time.sleep(0.5)
        
    # Save files
    with open("women_artisanal_products.json", "w", encoding="utf-8") as f:
        json.dump(broady_products, f, ensure_ascii=False, indent=2)
        
    with open("outfitters_fashion_marketplace.json", "w", encoding="utf-8") as f:
        json.dump(broady_products, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully scraped and structured {len(broady_products)} Outfitters products.")

if __name__ == "__main__":
    main()
