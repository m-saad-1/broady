import sys
import json
import re
import time
from datetime import datetime
from bs4 import BeautifulSoup
from curl_cffi import requests

sys.stdout.reconfigure(encoding='utf-8')

COLLECTION_URL = "https://cougar.com.pk/collections/men-golden-hour"

def get_product_urls():
    print(f"Fetching collection: {COLLECTION_URL}")
    response = requests.get(COLLECTION_URL, impersonate="chrome110")
    if response.status_code != 200:
        print(f"Failed to fetch collection: {response.status_code}")
        return []
        
    soup = BeautifulSoup(response.text, 'html.parser')
    handles = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/products/" in href:
            handle = href.split("/products/")[1].split("?")[0]
            handles.add(handle)
    return list(handles)

def parse_price(price_str):
    # Remove Rs., commas, and spaces
    clean = price_str.replace('Rs.', '').replace(',', '').strip()
    try:
        return float(clean)
    except:
        return 0.0

def get_taxonomy(description, title):
    # Try parsing style from description
    style = None
    style_match = re.search(r'Style:\s*([^\n]+)', description, re.I)
    if style_match:
        style = style_match.group(1).strip()
    
    if not style:
        # Fallback to title keywords
        t = title.lower()
        if 'shorts' in t:
            style = 'Shorts'
        elif 'polo' in t:
            style = 'Polo'
        elif 't-shirt' in t or 'tee' in t:
            style = 'T-Shirt'
        elif 'trouser' in t or 'pant' in t:
            style = 'Trousers'
        elif 'jean' in t or 'denim' in t:
            style = 'Jeans'
        elif 'shirt' in t:
            style = 'Shirt'
        else:
            style = 'Apparel'
            
    style_lower = style.lower()
    if 'shorts' in style_lower:
        return "Shorts", "Shorts"
    elif 'polo' in style_lower:
        return "Polos", "Polo Shirt"
    elif 't-shirt' in style_lower or 'tee' in style_lower:
        return "T-Shirts", "T-Shirt"
    elif 'trouser' in style_lower or 'pant' in style_lower:
        return "Trousers", "Trousers"
    elif 'jean' in style_lower or 'denim' in style_lower:
        return "Jeans", "Jeans"
    elif 'shirt' in style_lower:
        return "Shirts", "Casual Shirt"
    else:
        return "Apparel", style

def scrape_color_page(handle, color_name):
    url = f"https://cougar.com.pk/products/{handle}"
    try:
        response = requests.get(url, impersonate="chrome110", timeout=15)
        if response.status_code != 200:
            return [], [], ""
            
        soup = BeautifulSoup(response.text, 'html.parser')
        html_text = response.text
        
        # SKU
        sku = ''
        sku_match = re.search(r'SKU:\s*<!-- -->\s*([A-Z0-9\-]+)', html_text)
        if sku_match:
            sku = sku_match.group(1).strip()
            
        # SIZES & VARIANTS
        sizes = []
        size_buttons = soup.find_all('button', class_=re.compile(r'min-w-\[100px\]'))
        for btn in size_buttons:
            text = btn.get_text(strip=True)
            if not text or len(text) > 4: continue
            is_disabled = btn.has_attr('disabled') or 'cursor-not-allowed' in btn.get('class', [])
            sizes.append({
                'size': text,
                'available': not is_disabled
            })
            
        # IMAGES
        images = []
        img_containers = soup.find_all('div', class_='product-image')
        for idx, container in enumerate(img_containers):
            img = container.find('img')
            if img and img.has_attr('src'):
                src = img['src']
                src = src.split('&width=')[0]
                images.append({
                    "image_id": f"img_{handle}_{idx}",
                    "image_url": src,
                    "position": idx + 1,
                    "image_type": "main" if idx == 0 else "gallery"
                })
                
        return sizes, images, sku
    except Exception as e:
        print(f"Error scraping color page {handle}: {e}")
        return [], [], ""

def scrape_product(handle, seen_handles):
    url = f"https://cougar.com.pk/products/{handle}"
    try:
        response = requests.get(url, impersonate="chrome110", timeout=15)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        html_text = response.text
        
        # TITLE
        title_tag = soup.find('h1')
        title = title_tag.get_text(strip=True) if title_tag else handle.replace('-', ' ').title()
        
        # PRICING
        actual_price = 0.0
        final_price = 0.0
        price_div = soup.find('div', class_=re.compile(r'product-price'))
        if price_div:
            s_tag = price_div.find('s')
            span_tag = price_div.find('span')
            
            if s_tag and span_tag:
                actual_price = parse_price(s_tag.get_text())
                final_price = parse_price(span_tag.get_text())
            elif span_tag:
                final_price = parse_price(span_tag.get_text())
                actual_price = final_price
                
        # DESCRIPTION
        desc_div = soup.find('div', class_=re.compile(r'description'))
        desc = desc_div.get_text(separator="\n", strip=True) if desc_div else ''
        
        # PRIMARY COLOR
        color = ''
        color_p = soup.find(lambda tag: tag.name == 'p' and tag.find_next_sibling('div', class_='mt-1.5'))
        if color_p:
            color = color_p.get_text(strip=True)
            if ':' in color:
                color = color.split(':')[1].strip()
            
        # SIZES & VARIANTS of primary color
        primary_sizes = []
        size_buttons = soup.find_all('button', class_=re.compile(r'min-w-\[100px\]'))
        for btn in size_buttons:
            text = btn.get_text(strip=True)
            if not text or len(text) > 4: continue
            is_disabled = btn.has_attr('disabled') or 'cursor-not-allowed' in btn.get('class', [])
            primary_sizes.append({
                'size': text,
                'available': not is_disabled
            })
                
        # SKU of primary color
        primary_sku = ''
        sku_match = re.search(r'SKU:\s*<!-- -->\s*([A-Z0-9\-]+)', html_text)
        if sku_match:
            primary_sku = sku_match.group(1).strip()

        # IMAGES of primary color
        primary_images = []
        img_containers = soup.find_all('div', class_='product-image')
        for idx, container in enumerate(img_containers):
            img = container.find('img')
            if img and img.has_attr('src'):
                src = img['src']
                src = src.split('&width=')[0]
                primary_images.append({
                    "image_id": f"img_{handle}_{idx}",
                    "image_url": src,
                    "position": idx + 1,
                    "image_type": "main" if idx == 0 else "gallery"
                })
                
        # COLOR SWATCHES
        swatches = []
        swatches_container = soup.find('div', class_='mt-1.5')
        if swatches_container:
            for a in swatches_container.find_all('a'):
                title_attr = a.get('title')
                href = a.get('href')
                if href and '/products/' in href:
                    sibling_handle = href.split('/products/')[1].split('?')[0]
                    if title_attr:
                        swatches.append({
                            'color': title_attr.strip(),
                            'handle': sibling_handle
                        })
                        
        if not swatches:
            swatches.append({
                'color': color or 'Default',
                'handle': handle
            })
            
        # Gather all color data
        all_colors_data = []
        seen_handles.add(handle)
        
        for swatch in swatches:
            swatch_color = swatch['color']
            swatch_handle = swatch['handle']
            
            if swatch_handle == handle:
                all_colors_data.append({
                    'color': swatch_color,
                    'handle': swatch_handle,
                    'sizes': primary_sizes,
                    'images': primary_images,
                    'sku': primary_sku
                })
            else:
                print(f"  Scraping color variant '{swatch_color}': {swatch_handle}")
                sibling_sizes, sibling_images, sibling_sku = scrape_color_page(swatch_handle, swatch_color)
                all_colors_data.append({
                    'color': swatch_color,
                    'handle': swatch_handle,
                    'sizes': sibling_sizes,
                    'images': sibling_images,
                    'sku': sibling_sku
                })
                seen_handles.add(swatch_handle)
                time.sleep(0.5)

        # TAGS
        tags = []
        if 'shorts' in handle.lower():
            tags.extend(['Men', 'Shorts', 'Apparel'])
        elif 'shirt' in handle.lower() or 'polo' in handle.lower() or 'tee' in handle.lower():
            tags.extend(['Men', 'Shirts', 'T-Shirts', 'Apparel'])
        elif 'jeans' in handle.lower() or 'denim' in handle.lower() or 'pants' in handle.lower():
            tags.extend(['Men', 'Jeans', 'Pants', 'Apparel'])
        else:
            tags.extend(['Men', 'Apparel'])
            
        tag_match = re.search(r'"tags":\s*\[(.*?)\]', html_text)
        if tag_match:
            try:
                extracted_tags = [t.strip(' "\'') for t in tag_match.group(1).split(',')]
                tags.extend([t for t in extracted_tags if t])
            except:
                pass
        tags = list(set(tags))

        # SIZE GUIDE
        size_guide_text = ""
        sg_rows = soup.find_all('div', class_=re.compile(r'border-t.*border-gray-400'))
        sg_lines = []
        for row in sg_rows:
            row_text = row.get_text(separator=" | ", strip=True)
            if any(k in row_text.upper() for k in ['WAIST', 'THIGH', 'LENGTH', 'BOTTOM OPENING', 'SIZE', 'CHEST', 'SHOULDER']):
                sg_lines.append(row_text)
        if sg_lines:
            size_guide_text = "\n".join(sg_lines)
            
        notes = soup.find(string=re.compile(r'All measurements are in inches', re.I))
        if notes:
            parent = notes.find_parent('div')
            if parent:
                if size_guide_text:
                    size_guide_text += "\n\n" + parent.get_text(separator="\n", strip=True)
                else:
                    size_guide_text = parent.get_text(separator="\n", strip=True)

        # ACCORDIONS (Details, Shipping, Return, Disclaimer)
        care_guide = ""
        shipping = ""
        returns = ""
        disclaimer = ""
        
        accordions = soup.find_all('div', class_='product-accordian')
        for acc in accordions:
            parent_btn = acc.find_parent('div').find('button') if acc.find_parent('div') else None
            title_text = parent_btn.get_text(strip=True).lower() if parent_btn else ''
            
            content = acc.get_text(separator="\n", strip=True)
            if 'care' in title_text or 'details' in title_text:
                care_guide = content
            elif 'shipping' in title_text or 'deliver' in title_text:
                shipping = content
            elif 'return' in title_text or 'exchange' in title_text:
                returns = content
            elif 'disclaimer' in title_text:
                disclaimer = content
                
        if not care_guide and not shipping:
            # Fallback for accordions structure
            acc_btns = soup.find_all('button', class_=re.compile(r'w-full.*flex.*justify-between'))
            for btn in acc_btns:
                title_text = btn.get_text(strip=True).lower()
                content_div = btn.find_next_sibling('div')
                if content_div:
                    content = content_div.get_text(separator="\n", strip=True)
                    if 'care' in title_text or 'details' in title_text:
                        care_guide = content
                    elif 'shipping' in title_text or 'deliver' in title_text:
                        shipping = content
                    elif 'return' in title_text or 'exchange' in title_text:
                        returns = content
                    elif 'disclaimer' in title_text:
                        disclaimer = content
                        
        if not disclaimer:
            # Sometimes disclaimer is just a paragraph
            disc_p = soup.find(lambda tag: tag.name == 'p' and 'disclaimer' in tag.get_text(strip=True).lower())
            if disc_p:
                disclaimer = disc_p.get_text(strip=True)
                
        return {
            "title": title,
            "handle": handle,
            "actual_price": actual_price,
            "final_price": final_price,
            "description": desc,
            "care_guide": care_guide,
            "shipping": shipping,
            "returns": returns,
            "size_guide_text": size_guide_text,
            "disclaimer": disclaimer,
            "tags": tags,
            "colors_data": all_colors_data
        }
            
    except Exception as e:
        print(f"Error scraping {handle}: {e}")
        return None

def main():
    handles = get_product_urls()
    print(f"Found {len(handles)} product handles.")
    
    broady_products = []
    seen_handles = set()
    
    for idx, handle in enumerate(handles):
        if handle in seen_handles:
            print(f"Skipping {handle} (already processed as a color variant)")
            continue
            
        print(f"Scraping {idx+1}/{len(handles)}: {handle}")
        data = scrape_product(handle, seen_handles)
        if not data: continue
        
        pid = handle
        
        discount = 0
        if data['actual_price'] > data['final_price'] and data['actual_price'] > 0:
            discount = round(((data['actual_price'] - data['final_price']) / data['actual_price']) * 100)
            
        # Determine taxonomy
        subcat, prod_type = get_taxonomy(data['description'], data['title'])
        
        prod = {
            "id": f"broady_{pid}",
            "external_product_id": pid,
            "brand_id": "brand_cougar",
            "brand_name": "Cougar",
            "title": data['title'],
            "slug": handle,
            "description": data['description'],
            "gender": "Men", 
            "category": "Clothing",
            "subcategory": subcat,
            "product_type": prod_type,
            "status": "active",
            "visibility": "visible",
            "source": "html_scraper",
            "product_url": f"https://cougar.com.pk/products/{handle}",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Flat pricing fields (what Broady normalization.service reads)
        prod["actual_price"]         = data['actual_price']
        prod["sale_price"]           = data['final_price'] if discount > 0 else None
        prod["compare_at_price"]     = data['actual_price']
        prod["price"]                = data['final_price']
        prod["currency"]             = "PKR"
        prod["discount_percentage"] = discount
        prod["is_on_sale"]           = discount > 0
        
        variants = []
        all_images = []
        img_idx = 0
        
        for cdata in data['colors_data']:
            color_name = cdata['color']
            color_handle = cdata['handle']
            color_sku = cdata['sku']
            color_sizes = cdata['sizes']
            
            if not color_sizes:
                color_sizes = [{'size': 'Standard', 'available': True}]
                
            for s in color_sizes:
                is_avail = s['available']
                variant = {
                    "variant_id": f"broady_var_{pid}_{color_name.lower().replace(' ', '_')}_{s['size']}",
                    "external_variant_id": f"{color_handle}_{s['size']}",
                    "product_id": prod['id'],
                    "sku": f"{color_sku}-{s['size']}" if color_sku else '',
                    "barcode": '',
                    "color_name": color_name,
                    # option1/option2 aliases for Broady normalization
                    "option1": color_name,
                    "option2": s['size'],
                    "color": color_name,
                    "size": s['size'],
                    "price": data['final_price'],
                    "compare_at_price": data['actual_price'],
                    "stock_status": "in_stock" if is_avail else "out_of_stock",
                    "is_available": is_avail,
                    # inventory_quantity as a number (required by normalization)
                    "inventory_quantity": 10 if is_avail else 0
                }
                variants.append(variant)
                
            for img in cdata['images']:
                img_url = img['image_url']
                all_images.append({
                    "image_id": f"img_{color_handle}_{img_idx}",
                    "image_url": img_url,
                    # 'src' and 'url' aliases for Broady normalization
                    "src": img_url,
                    "url": img_url,
                    "position": img_idx + 1,
                    "image_type": "main" if img_idx == 0 else "gallery",
                    "product_id": prod['id']
                })
                img_idx += 1
            
        prod["variants"] = variants   # lowercase key for Broady normalization
        
        # Ensure unique images
        unique_images = []
        seen_img = set()
        for img in all_images:
            if img['image_url'] not in seen_img:
                seen_img.add(img['image_url'])
                unique_images.append(img)
                
        prod["images"] = unique_images   # lowercase key for Broady normalization
        
        # Flat detail fields (what Broady normalization.service reads)
        prod["fabric_composition"]     = None
        prod["care_guide"]             = data['care_guide']
        prod["size_guide_text"]        = data['size_guide_text']
        prod["shipping_delivery"]      = data['shipping']
        prod["return_exchange_policy"] = data['returns']
        prod["disclaimer"]             = data['disclaimer']
        
        prod["tags"] = data['tags']
        
        # Flat shipping fields
        prod["estimated_delivery_min_days"] = 3
        prod["estimated_delivery_max_days"] = 5
        prod["delivery_text"]               = "Delivered in 3-5 working days"
        prod["cod_available"]               = True
        prod["return_available"]            = True
        prod["exchange_available"]          = True
        
        # Flat SEO fields
        prod["meta_title"]    = prod['title']
        prod["canonical_url"] = f"https://cougar.com.pk/products/{handle}"
        
        broady_products.append(prod)
        time.sleep(0.5)

    with open("broady_fashion_marketplace.json", "w", encoding='utf-8') as f:
        f.write(json.dumps(broady_products, indent=2))

    print(f"Successfully fully scraped and structured {len(broady_products)} products.")

if __name__ == "__main__":
    main()
