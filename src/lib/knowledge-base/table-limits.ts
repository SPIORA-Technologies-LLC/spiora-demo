/** Phase 1A Knowledge Base editable table limits (client + server). */

export const KB_TABLE_SCHEMA_VERSION = 1;

export const MAX_KB_TABLE_ROWS = 1000;
export const MAX_KB_TABLE_COLUMNS = 50;
export const MAX_KB_TABLE_CELLS = 50_000;
export const MAX_KB_TABLE_CELL_CHARS = 2000;
export const MAX_KB_TABLE_TITLE_CHARS = 200;
export const MAX_KB_TABLE_DESCRIPTION_CHARS = 2000;
export const MAX_KB_TABLE_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_KB_TABLE_JSON_BYTES = 2 * 1024 * 1024;
export const MAX_KB_TABLES_PER_ARTICLE = 10;

export const KB_TABLE_COLUMN_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "url",
] as const;

export type KbTableColumnType = (typeof KB_TABLE_COLUMN_TYPES)[number];

export type KbTableCellValue = string | number | boolean | null;

export type KbTableColumn = {
  id: string;
  name: string;
  type: KbTableColumnType;
  width?: number;
};

export type KbTableRow = {
  id: string;
  cells: Record<string, KbTableCellValue>;
};

export type KbTableDocument = {
  columns: KbTableColumn[];
  rows: KbTableRow[];
};

export function emptyKbTableDocument(
  columnCount = 3,
  rowCount = 3,
): KbTableDocument {
  const cols = Math.min(Math.max(columnCount, 1), MAX_KB_TABLE_COLUMNS);
  const rows = Math.min(Math.max(rowCount, 0), MAX_KB_TABLE_ROWS);
  const columns: KbTableColumn[] = Array.from({ length: cols }, (_, i) => ({
    id: cryptoRandomId("col"),
    name: `Column ${i + 1}`,
    type: "text" as const,
    width: 160,
  }));
  const tableRows: KbTableRow[] = Array.from({ length: rows }, () => ({
    id: cryptoRandomId("row"),
    cells: Object.fromEntries(columns.map((c) => [c.id, ""])),
  }));
  return { columns, rows: tableRows };
}

/** Deterministic-ish id for Node + browser without depending on crypto module shape. */
export function cryptoRandomId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
          const r = (Math.random() * 16) | 0;
          const v = ch === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return `${prefix}_${uuid}`;
}

export function countKbTableCells(doc: KbTableDocument): number {
  return doc.rows.length * doc.columns.length;
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Escape CSV formula injection on export (OWASP-style).
 * Prefixes a leading apostrophe when the value could be interpreted as a formula,
 * including leading tab/CR/whitespace before = + - @.
 */
export function escapeCsvFormula(value: string): string {
  if (/^[\t\r]/.test(value) || /^[\t\r ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}
