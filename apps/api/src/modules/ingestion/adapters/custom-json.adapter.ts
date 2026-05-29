import type { BrandAdapter } from "./adapter.interface.js";
import type { ParsedImportRecord } from "../ingestion.types.js";

function pickRecordArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;
  const candidates = [
    record.products,
    record.items,
    record.data,
    record.records,
    record.results,
    record.catalog,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (
    typeof record.title === "string" ||
    typeof record.name === "string" ||
    (record.product && typeof record.product === "object")
  ) {
    return [record];
  }

  return [];
}

function extractExternalId(item: Record<string, unknown>): string | undefined {
  const value =
    item.external_product_id ??
    item.externalId ??
    item.id ??
    (item.product && typeof item.product === "object" ? (item.product as Record<string, unknown>).id : undefined);

  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

export class CustomJsonAdapter implements BrandAdapter {
  parse(raw: unknown): ParsedImportRecord[] {
    const records = pickRecordArray(raw);
    return records.map((item) => {
      const normalized = (item ?? {}) as Record<string, unknown>;
      return {
        externalId: extractExternalId(normalized),
        raw: normalized,
      };
    });
  }
}
