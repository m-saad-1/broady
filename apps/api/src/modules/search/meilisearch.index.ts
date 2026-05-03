import { createMeiliSearch } from "../../config/meilisearch.js";
import { getProductsIndexSettings, PRODUCTS_INDEX_UID } from "./meilisearch.product-document.js";

const TASK_WAIT: { timeout: number } = { timeout: 120_000 };

/**
 * Ensures the `products` index exists with primary key `id` and applies settings.
 * Requires an admin-capable API key (see `createMeiliSearch("admin")`).
 */
export async function ensureProductsIndex() {
  const client = createMeiliSearch("admin");
  const uid = PRODUCTS_INDEX_UID;

  let exists = false;
  try {
    await client.getRawIndex(uid);
    exists = true;
  } catch {
    exists = false;
  }

  if (!exists) {
    const created = await client.createIndex(uid, { primaryKey: "id" });
    await client.tasks.waitForTask(created.taskUid, TASK_WAIT);
  }

  const index = client.index(uid);
  const settingsTask = await index.updateSettings(getProductsIndexSettings());
  await client.tasks.waitForTask(settingsTask.taskUid, TASK_WAIT);

  return index;
}
