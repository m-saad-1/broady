import type { BrandAdapter } from "./adapter.interface.js";
import type { ParsedImportRecord } from "../ingestion.types.js";

function resolveShopifyRecords(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.map((item) => (item ?? {}) as Record<string, unknown>);
  }

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const record = raw as Record<string, unknown>;

  if (Array.isArray(record.products)) {
    return record.products.map((item) => (item ?? {}) as Record<string, unknown>);
  }

  if (record.product && typeof record.product === "object") {
    return [record as Record<string, unknown>];
  }

  return [];
}

export class ShopifyAdapter implements BrandAdapter {
  parse(raw: unknown): ParsedImportRecord[] {
    const records = resolveShopifyRecords(raw);
    return records.map((item) => ({
      externalId: typeof item?.id === "string" ? item.id : typeof item?.id === "number" ? String(item.id) : undefined,
      raw: (item ?? {}) as Record<string, unknown>,
    }));
  }
}
