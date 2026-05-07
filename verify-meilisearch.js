#!/usr/bin/env node
/**
 * Meilisearch Verification Script
 * Tests all Meilisearch components and provides diagnostic info
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n╔${"═".repeat(60)}╗`, "cyan");
  log(`║ ${title.padEnd(58)} ║`, "cyan");
  log(`╚${"═".repeat(60)}╝\n`, "cyan");
}

async function checkEnvironment() {
  section("1. Environment Configuration");

  const envPath = path.join(__dirname, ".env");

  try {
    const envContent = readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");

    const meilisearchVars = [
      "MEILISEARCH_URL",
      "MEILISEARCH_DATABASE_URL",
      "MEILI_MASTER_KEY",
      "MEILISEARCH_ADMIN_API_KEY",
      "MEILISEARCH_SEARCH_API_KEY",
      "MEILISEARCH_CHAT_API_KEY",
      "MEILISEARCH_ENABLE_PRODUCT_SEARCH",
    ];

    log("Meilisearch Environment Variables:", "blue");
    meilisearchVars.forEach((varName) => {
      const line = lines.find((l) => l.startsWith(`${varName}=`));
      if (line) {
        const value = line.split("=")[1];
        const status = value && value !== "" ? "green" : "yellow";
        const display = value && value.length > 50 ? value.substring(0, 47) + "..." : value;
        log(`  ✓ ${varName}: ${display}`, status);
      } else {
        log(`  ✗ ${varName}: NOT SET`, "yellow");
      }
    });
  } catch (error) {
    log(`  ✗ Error reading .env: ${error.message}`, "red");
  }
}

async function checkPostgreSQL() {
  section("2. PostgreSQL Database");

  try {
    const result = execSync("psql -U postgres -d broady -h localhost -c 'SELECT version();'", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    log("  ✓ PostgreSQL is running", "green");
    log(`    ${result.split("\n")[0]}`, "blue");

    // Check products table
    try {
      const productsResult = execSync(
        "psql -U postgres -d broady -h localhost -c 'SELECT COUNT(*) as product_count FROM \"Product\";'",
        { encoding: "utf-8" }
      ).trim();
      const count = productsResult.match(/\d+/)?.[0];
      log(`    Products in database: ${count}`, "blue");
    } catch {
      log("    Could not query Product table", "yellow");
    }
  } catch (error) {
    log("  ✗ PostgreSQL not accessible", "red");
    log(`    Make sure PostgreSQL is running on localhost:5432`, "yellow");
    log(`    Error: ${error.message.split("\n")[0]}`, "yellow");
  }
}

async function checkMeilisearchLocal() {
  section("3. Local Meilisearch (Binary)");

  try {
    const response = await fetch("http://127.0.0.1:7700/health");
    if (response.ok) {
      log("  ✓ Local Meilisearch is running on http://127.0.0.1:7700", "green");

      try {
        const indexStats = await fetch("http://127.0.0.1:7700/indexes/products/stats");
        if (indexStats.ok) {
          const stats = await indexStats.json();
          log(`    Products index: ${stats.numberOfDocuments} documents`, "blue");
        } else {
          log("    Products index: NOT FOUND (need to create and upload)", "yellow");
        }
      } catch {
        log("    Could not check index stats", "yellow");
      }
    } else {
      log(`  ✗ Meilisearch not responding (status: ${response.status})`, "yellow");
    }
  } catch (error) {
    log("  ✗ Local Meilisearch not accessible", "yellow");
    log(`    Start with: meilisearch --master-key 'your-key'`, "yellow");
    log(`    Or download from: https://github.com/meilisearch/meilisearch/releases`, "yellow");
  }
}

async function checkProductExtraction() {
  section("4. Product Extraction");

  try {
    const exportPath = path.join(__dirname, "docs", "MEILISEARCH_PRODUCTS_EXPORT.json");
    const content = readFileSync(exportPath, "utf-8");
    const products = JSON.parse(content);
    log(`  ✓ Product export file found: ${products.length} products`, "green");

    if (products.length > 0) {
      log(`    First product: ${products[0].name}`, "blue");
      log(`    Fields: ${Object.keys(products[0]).join(", ")}`, "blue");
    }
  } catch (error) {
    log("  ✗ Product export not found or invalid", "yellow");
    log(`    Run: node extract-products.js`, "yellow");
  }
}

async function checkAPIHealth() {
  section("5. Broady API");

  try {
    const response = await fetch("http://localhost:4000/health");
    if (response.ok) {
      const health = await response.json();
      log("  ✓ API is running on http://localhost:4000", "green");
      log(`    Status: ${health.status}`, health.connected ? "green" : "red");
      log(`    Database: ${health.connected ? "CONNECTED" : "DISCONNECTED"}`, health.connected ? "green" : "red");

      if (health.responseTimeMs) {
        log(`    Response time: ${health.responseTimeMs}ms`, "blue");
      }
    } else {
      log(`  ✗ API not responding (status: ${response.status})`, "yellow");
    }
  } catch (error) {
    log("  ✗ API not accessible on http://localhost:4000", "yellow");
    log(`    Start with: npm run dev -w @broady/api`, "yellow");
  }
}

async function testSearch() {
  section("6. Search Functionality");

  try {
    const response = await fetch("http://localhost:4000/api/products?q=shirt&topCategory=Men");
    if (response.ok) {
      const data = await response.json();
      log("  ✓ Search endpoint is responding", "green");
      log(`    Results: ${data.data?.length || 0} products found`, "blue");

      if (data.cached) {
        log(`    Using cache`, "blue");
      }
    } else {
      log(`  ✗ Search endpoint not responding (status: ${response.status})`, "yellow");
    }
  } catch (error) {
    log("  ✗ Cannot test search endpoint", "yellow");
    log(`    Make sure API is running on http://localhost:4000`, "yellow");
  }
}

async function generateChecklist() {
  section("7. Setup Checklist");

  const tasks = [
    {
      title: "PostgreSQL is running",
      command: "psql -U postgres -c 'SELECT 1;'",
    },
    {
      title: "Meilisearch is running",
      command: "curl http://127.0.0.1:7700/health",
    },
    {
      title: "Products extracted to JSON",
      check: () => {
        try {
          readFileSync(path.join(__dirname, "docs", "MEILISEARCH_PRODUCTS_EXPORT.json"));
          return true;
        } catch {
          return false;
        }
      },
    },
    {
      title: ".env configured with Meilisearch keys",
      check: () => {
        const env = readFileSync(path.join(__dirname, ".env"), "utf-8");
        return (
          env.includes("MEILISEARCH_URL") ||
          env.includes("MEILISEARCH_DATABASE_URL") ||
          env.includes("MEILI_MASTER_KEY")
        );
      },
    },
    {
      title: "API is running",
      command: "curl http://localhost:4000/health",
    },
    {
      title: "Web is running",
      command: "curl http://localhost:3000",
    },
    {
      title: "Search endpoint responds",
      command: "curl http://localhost:4000/api/products?q=test",
    },
  ];

  for (const task of tasks) {
    let status = "yellow";

    if (task.check) {
      try {
        status = task.check() ? "green" : "yellow";
      } catch {
        status = "yellow";
      }
    } else if (task.command) {
      try {
        execSync(task.command, { stdio: "pipe", timeout: 3000 });
        status = "green";
      } catch {
        status = "yellow";
      }
    }

    const symbol = status === "green" ? "✓" : "○";
    log(`  ${symbol} ${task.title}`, status);
  }
}

async function main() {
  log("\n╔═══════════════════════════════════════════════════════════╗", "cyan");
  log("║        Broady Meilisearch Verification Tool              ║", "cyan");
  log("║              Version 1.0 - Setup Check                   ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");

  await checkEnvironment();
  await checkPostgreSQL();
  await checkMeilisearchLocal();
  await checkProductExtraction();
  await checkAPIHealth();
  await testSearch();
  await generateChecklist();

  section("Next Steps");
  log("1. Start PostgreSQL (if not running):", "blue");
  log('   Windows Service: Start-Service postgresql-x64-16', "blue");
  log("   Or: npm run db:up (if Docker installed)", "blue");

  log("\n2. Extract all products from database:", "blue");
  log("   node extract-products.js", "blue");

  log("\n3. Start Meilisearch (local development):", "blue");
  log("   meilisearch", "blue");

  log("\n4. Upload products to Meilisearch:", "blue");
  log("   Via dashboard or curl (see docs/MEILISEARCH_SETUP_COMPLETE.md)", "blue");

  log("\n5. Configure .env with API keys:", "blue");
  log("   Update MEILISEARCH_ADMIN_API_KEY and other keys", "blue");

  log("\n6. Start the application:", "blue");
  log("   npm run dev", "blue");

  log("\nFor full guide, see: docs/MEILISEARCH_SETUP_COMPLETE.md", "cyan");
  log("\n");
}

main().catch((error) => {
  log(`\nFatal error: ${error.message}`, "red");
  process.exit(1);
});
