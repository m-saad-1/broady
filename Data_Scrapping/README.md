# Outfitters Collection Scraper

This utility scrapes 10 products from each Outfitters collection URL, enriches them via Shopify product JSON, and normalizes the output into Broady-compatible fields.

## Files

- `outfitters_scraper.py` - scrapes the collection pages and product pages.
- `outfitters/normalize_expanded_to_broady.py` - normalizes expanded scrape to Broady schema.

## Install

```powershell
& 'd:/WEB DEVELOPMENT/extract data/.venv/Scripts/python.exe' -m pip install -r 'd:/WEB DEVELOPMENT/extract data/requirements.txt'
```

## Run Scraper

```powershell
& 'd:/WEB DEVELOPMENT/extract data/.venv/Scripts/python.exe' 'd:/WEB DEVELOPMENT/extract data/outfitters_scraper.py'
```

## Normalize to Broady

```powershell
& 'd:/WEB DEVELOPMENT/extract data/.venv/Scripts/python.exe' 'd:/WEB DEVELOPMENT/extract data/outfitters/normalize_expanded_to_broady.py'
```

## Outputs

- `outfitters/outfitters_10_per_collection_expanded.json`
- `outfitters/outfitters_10_per_collection_broady.json`
