/**
 * Relational data virtualization (M3.E3.T2).
 *
 * Accepts tabular data (array of objects or CSV string) and merges
 * it as supplementary properties on matching UGM nodes.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/03-technical-data-layer.md R3.7
 * @see specs/06-integration-connectors.md R6.1
 */

import type { UGM } from "@core/ugm";

export interface VirtualizeOptions {
  /** The field in the tabular data that matches UGM node IDs. Default: "id". */
  keyField?: string;
}

/**
 * Merge tabular data as supplementary properties on UGM nodes.
 * @returns the number of nodes that were matched and updated.
 * @see R3.8, R6.3: unstructured data linkage
 */
export function virtualizeRelationalData(
  ugm: UGM,
  data: Record<string, unknown>[],
  options?: VirtualizeOptions,
): number {
  const keyField = options?.keyField ?? "id";
  let matchCount = 0;

  for (const row of data) {
    const nodeId = row[keyField];
    if (typeof nodeId !== "string") continue;
    if (!ugm.hasNode(nodeId)) continue;

    // Merge all columns except the key field as properties
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key !== keyField) {
        properties[key] = value;
      }
    }

    ugm.updateNodeProperties(nodeId, properties);
    matchCount++;
  }

  return matchCount;
}

/**
 * Parse a CSV string into an array of row objects.
 * Simple parser; handles quoted fields with commas.
 */
export function parseCSV(csv: string): Record<string, unknown>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0] ?? "");
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i] ?? "");
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        const val = values[j] ?? "";
        // Auto-convert numeric values
        const num = Number(val);
        row[header] = val !== "" && !isNaN(num) ? num : val;
      }
    }
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());

  return result;
}
