import type { ParsedImportRecord } from "../ingestion.types.js";

export interface BrandAdapter {
  parse(raw: unknown): ParsedImportRecord[];
}
