/**
 * One-shot: create/update `products` index settings and upsert all products from Postgres.
 *
 * Usage (from repo root): `npm run search:meili:sync -w @broady/api`
 * Requires `apps/api/.env` with Meilisearch admin (or master) credentials.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BATCH = 500;

/** Meilisearch Cloud default API keys are long hex strings; they only work with the Cloud project HTTPS host. */
const CLOUD_LIKE_KEY_MIN_LEN = 48;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function assertMeilisearchHostForCloudKeys() {
  const { env } = await import("../config/env.js");
  const { resolveMeilisearchApiKey } = await import("../config/meilisearch.js");
  const admin = resolveMeilisearchApiKey("admin").trim();
  let host: string;
  try {
    host = new URL(env.meilisearchUrl).hostname;
  } catch {
    console.error(`MEILISEARCH_URL / MEILISEARCH_DATABASE_URL is not a valid URL: ${env.meilisearchUrl}`);
    process.exit(1);
  }
  const local = host === "localhost" || host === "127.0.0.1";
  if (local && admin.length >= CLOUD_LIKE_KEY_MIN_LEN) {
    console.error(`
Meilisearch Cloud API keys (from https://cloud.meilisearch.com/.../settings/api-keys) only work
against your project's HTTPS search host — not http://127.0.0.1:7700.

Fix:
1. In Meilisearch Cloud, open your project → Settings.
2. Copy the "Database URL" / instance host (looks like https://ms-<id>.<region>.meilisearch.io).
3. In apps/api/.env set either:
     MEILISEARCH_URL=<that https URL>
   or:
     MEILISEARCH_DATABASE_URL=<that https URL>

Keep the same Admin / Search / Chat keys from the API Keys page.

Reference: https://www.meilisearch.com/docs/reference/features/authentication
`);
    process.exit(1);
  }
}

async function main() {
  await assertMeilisearchHostForCloudKeys();

  const { prisma } = await import("../config/prisma.js");
  const { createMeiliSearch, resolveMeilisearchApiKey } = await import("../config/meilisearch.js");
  const { ensureProductsIndex } = await import("../modules/search/meilisearch.index.js");
  const { mapProductToMeiliDocument } = await import("../modules/search/meilisearch.product-document.js");

  if (!resolveMeilisearchApiKey("admin").trim()) {
    console.error("Missing admin credentials: set MEILISEARCH_ADMIN_API_KEY or MEILISEARCH_API_KEY or MEILI_MASTER_KEY.");
    process.exit(1);
  }

  const client = createMeiliSearch("admin");
  const index = await ensureProductsIndex();

  const products = await prisma.product.findMany({
    include: { brand: true, reviewAggregate: true },
    orderBy: { id: "asc" },
  });

  const docs = products.map(mapProductToMeiliDocument);
  let n = 0;
  for (const batch of chunk(docs, BATCH)) {
    const task = await index.updateDocuments(batch);
    await client.tasks.waitForTask(task.taskUid, { timeout: 600_000 });
    n += batch.length;
    console.error(`Indexed ${n}/${docs.length} documents…`);
  }

  console.error(`Meilisearch sync complete: ${docs.length} documents in index.`);
}

main()
  .catch((e: unknown) => {
    const err = e as { cause?: { code?: string }; code?: string };
    const code = err?.cause?.code ?? err?.code;
    if (code === "invalid_api_key") {
      console.error(`
Meilisearch returned invalid_api_key. Common causes:
• MEILISEARCH_URL points to the wrong host (use your Cloud "Database URL", not cloud.meilisearch.com and not localhost with Cloud keys).
• Keys were rotated in Cloud but .env was not updated.

See: https://www.meilisearch.com/docs/reference/features/authentication
`);
    }
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../config/prisma.js");
    await prisma.$disconnect();
  });
