# Breakout Scraper

This folder contains the Breakout product scraper and the normalized Broady export.

## What it does

- Scrapes selected Breakout collections for Men, Women, Boys, and Girls.
- Collapses color-specific Shopify handles into one Broady product record per base product.
- Normalizes the output to the Broady product schema.
- Extracts description, fabric/care, model notes, disclaimer text, images, variants, and policy-backed shipping/return details.

## Files

- `breakout_scraper.py` - live scraper and Broady normalizer.
- `breakout_broady.json` - normalized output.
- `breakout_expanded.json` - expanded scrape and raw audit data.

## Run

```powershell
& 'd:/WEB DEVELOPMENT/broady/Data_Scrapping/.venv/Scripts/python.exe' 'd:/WEB DEVELOPMENT/broady/Data_Scrapping/breakout/breakout_scraper.py'
```

If the local virtual environment is unavailable, run the script with any Python interpreter that has `requests` and `beautifulsoup4` installed.
