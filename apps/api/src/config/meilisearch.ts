import { Meilisearch } from "meilisearch";
import { env } from "./env.js";

export type MeilisearchClientRole = "admin" | "search" | "chat";

/**
 * Resolves the HTTP API key for the JS client.
 * - `admin`: index/settings/documents (prefers admin key, then legacy MEILISEARCH_API_KEY, then master key).
 * - `search`: search-only routes (search key only; never falls back to master).
 * - `chat`: Meilisearch chat APIs (chat key, then master as last resort).
 */
export function resolveMeilisearchApiKey(role: MeilisearchClientRole = "admin"): string {
  const admin = env.meilisearchAdminApiKey.trim();
  const legacy = env.meilisearchApiKey.trim();
  const master = env.meiliMasterKey.trim();
  const search = env.meilisearchSearchApiKey.trim();
  const chat = env.meilisearchChatApiKey.trim();

  if (role === "search") {
    return search;
  }
  if (role === "chat") {
    return chat || master;
  }
  return admin || legacy || master;
}

/** Node client for Meilisearch. */
export function createMeiliSearch(role: MeilisearchClientRole = "admin"): Meilisearch {
  const apiKey = resolveMeilisearchApiKey(role);
  return new Meilisearch({
    host: env.meilisearchUrl,
    ...(apiKey ? { apiKey } : {}),
  });
}
