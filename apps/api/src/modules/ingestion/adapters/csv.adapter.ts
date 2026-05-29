import type { BrandAdapter } from "./adapter.interface.js";
import type { ParsedImportRecord } from "../ingestion.types.js";

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      parts.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }

  parts.push(value.trim());
  return parts;
}

export class CsvAdapter implements BrandAdapter {
  parse(raw: unknown): ParsedImportRecord[] {
    if (typeof raw !== "string") return [];
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const header = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const mapped: Record<string, unknown> = {};
      header.forEach((key, index) => {
        mapped[key] = values[index] ?? "";
      });
      return {
        externalId: typeof mapped.external_product_id === "string" ? mapped.external_product_id : undefined,
        raw: mapped,
      };
    });
  }
}
