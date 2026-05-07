#!/usr/bin/env node
/**
 * Extract Products via API
 * Uses the running Broady API to fetch all products and export as JSON
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = "http://localhost:4000/api";

async function extractProductsViaAPI() {
  console.log("Fetching all products from Broady API...\n");

  try {
    // Fetch all products (no filter = all approved/active)
    // The API returns products with brand info
    const response = await fetch(`${API_BASE}/products`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const apiResponse = await response.json();
    const products = apiResponse.data || [];

    console.log(`✅ Fetched ${products.length} products from API\n`);

    if (products.length === 0) {
      console.log("⚠️  No products found. Check database has approved products.");
      return;
    }

    // Map API response to Meilisearch document format
    const meilisearchDocs = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      searchDocument: product.searchDocument || "",
      brandId: product.brandId,
      brandName: product.brand?.name || "",
      brandSlug: product.brand?.slug || "",
      pricePkr: product.pricePkr,
      topCategory: product.topCategory,
      subCategory: product.subCategory,
      sizes: product.sizes || [],
      imageUrl: product.imageUrl || "",
      stock: product.stock,
      isActive: product.isActive,
      approvalStatus: product.approvalStatus,
      createdAt: Math.floor(new Date(product.createdAt).getTime() / 1000),
      updatedAt: Math.floor(new Date(product.updatedAt).getTime() / 1000),
      averageRating: product.averageRating || 0,
      totalReviews: product.totalReviews || 0,
    }));

    // Save to file
    const exportPath = path.join(__dirname, "docs", "MEILISEARCH_PRODUCTS_EXPORT.json");
    fs.writeFileSync(exportPath, JSON.stringify(meilisearchDocs, null, 2));

    console.log(`📄 Saved to: docs/MEILISEARCH_PRODUCTS_EXPORT.json`);
    console.log(`\n📊 Export Summary:`);
    console.log(`   Total Products: ${meilisearchDocs.length}`);
    console.log(`   Categories: ${[...new Set(meilisearchDocs.map((p) => p.topCategory))].join(", ")}`);
    console.log(`   Brands: ${[...new Set(meilisearchDocs.map((p) => p.brandSlug))].join(", ")}`);

    const avgPrice = (meilisearchDocs.reduce((sum, p) => sum + p.pricePkr, 0) / meilisearchDocs.length).toFixed(0);
    console.log(`   Avg Price: PKR ${avgPrice}`);

    const priceRange = {
      min: Math.min(...meilisearchDocs.map((p) => p.pricePkr)),
      max: Math.max(...meilisearchDocs.map((p) => p.pricePkr)),
    };
    console.log(`   Price Range: PKR ${priceRange.min} - PKR ${priceRange.max}`);

    console.log(`\n✨ Ready for Meilisearch upload!`);
    console.log(`   Next: Upload this file to Meilisearch Cloud or local instance`);
  } catch (error) {
    console.error("❌ Error extracting products:", error.message);
    console.log(
      "\n⚠️  Make sure the API is running: npm run dev -w @broady/api"
    );
  }
}

extractProductsViaAPI();
