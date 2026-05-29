import type { ParsedImportRecord } from "../ingestion.types.js";
import type { ImportInputPayload } from "../ingestion.types.js";
import { getAdapter } from "./adapter.factory.js";
import { CsvAdapter } from "../adapters/csv.adapter.js";
import { CustomJsonAdapter } from "../adapters/custom-json.adapter.js";

export function parseImportPayload(payload: ImportInputPayload): ParsedImportRecord[] {
  if (payload.sourceType === "MANUAL_UPLOAD") {
    const rawText = payload.rawText ?? payload.fileBuffer?.toString("utf8") ?? "";
    const jsonAdapter = new CustomJsonAdapter();
    const csvAdapter = new CsvAdapter();

    if (payload.rawJson !== undefined) {
      return jsonAdapter.parse(payload.rawJson);
    }

    if (rawText.trim()) {
      try {
        const parsed = JSON.parse(rawText);
        const jsonRows = jsonAdapter.parse(parsed);
        if (jsonRows.length) return jsonRows;
      } catch {
        // Continue to CSV fallback.
      }

      return csvAdapter.parse(rawText);
    }

    return [];
  }

  const adapter = getAdapter(payload.sourceType);

  if (payload.sourceType === "CSV") {
    const csvText = payload.rawText ?? payload.fileBuffer?.toString("utf8") ?? "";
    return adapter.parse(csvText);
  }

  if (payload.rawJson !== undefined) {
    return adapter.parse(payload.rawJson);
  }

  if (payload.rawText) {
    const parsed = JSON.parse(payload.rawText);
    return adapter.parse(parsed);
  }

  if (payload.fileBuffer) {
    const parsed = JSON.parse(payload.fileBuffer.toString("utf8"));
    return adapter.parse(parsed);
  }

  return [];
}
