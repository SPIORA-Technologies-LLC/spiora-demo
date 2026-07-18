import {
  MAX_KB_TABLE_CELL_CHARS,
  MAX_KB_TABLE_CELLS,
  MAX_KB_TABLE_COLUMNS,
  MAX_KB_TABLE_CSV_BYTES,
  MAX_KB_TABLE_ROWS,
  cryptoRandomId,
  escapeCsvFormula,
  type KbTableColumnType,
  type KbTableDocument,
} from "./table-limits";
import { suggestColumnType, validateKbTableDocument } from "./table-document";

export type CsvParseError =
  | "empty"
  | "too_large"
  | "too_many_rows"
  | "too_many_columns"
  | "too_many_cells"
  | "cell_too_long"
  | "malformed";

export type CsvParseResult = {
  delimiter: "," | ";";
  matrix: string[][];
};

/** RFC4180-ish CSV parser with comma/semicolon auto-detect. */
export function parseCsvText(raw: string): { ok: true; data: CsvParseResult } | { ok: false; error: CsvParseError } {
  if (raw.length > MAX_KB_TABLE_CSV_BYTES) return { ok: false, error: "too_large" };
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.trim()) return { ok: false, error: "empty" };

  const sample = text.slice(0, 4000);
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  const delimiter: "," | ";" = semis > commas ? ";" : ",";

  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      matrix.push(row);
      row = [];
      if (ch === "\r") i += 1;
      continue;
    }
    if (ch === "\r") {
      row.push(field);
      field = "";
      matrix.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (inQuotes) return { ok: false, error: "malformed" };
  row.push(field);
  if (row.length > 1 || row[0] !== "" || matrix.length === 0) {
    matrix.push(row);
  }

  // Drop trailing empty line
  while (
    matrix.length &&
    matrix[matrix.length - 1]!.length === 1 &&
    matrix[matrix.length - 1]![0] === ""
  ) {
    matrix.pop();
  }

  if (!matrix.length) return { ok: false, error: "empty" };
  const width = Math.max(...matrix.map((r) => r.length));
  if (width > MAX_KB_TABLE_COLUMNS) return { ok: false, error: "too_many_columns" };
  if (matrix.length > MAX_KB_TABLE_ROWS + 1) return { ok: false, error: "too_many_rows" };

  for (const r of matrix) {
    while (r.length < width) r.push("");
    for (const cell of r) {
      if (cell.length > MAX_KB_TABLE_CELL_CHARS) return { ok: false, error: "cell_too_long" };
    }
  }

  return { ok: true, data: { delimiter, matrix } };
}

export function csvMatrixToDocument(
  matrix: string[][],
  options: { headerRow: boolean; types?: KbTableColumnType[] },
): { ok: true; data: KbTableDocument } | { ok: false; error: CsvParseError } {
  if (!matrix.length) return { ok: false, error: "empty" };
  const headerRow = options.headerRow;
  const dataRows = headerRow ? matrix.slice(1) : matrix;
  const headers = headerRow
    ? matrix[0]!.map((h, i) => h.trim() || `Column ${i + 1}`)
    : matrix[0]!.map((_, i) => `Column ${i + 1}`);

  if (headers.length > MAX_KB_TABLE_COLUMNS) return { ok: false, error: "too_many_columns" };
  if (dataRows.length > MAX_KB_TABLE_ROWS) return { ok: false, error: "too_many_rows" };
  if (dataRows.length * headers.length > MAX_KB_TABLE_CELLS) {
    return { ok: false, error: "too_many_cells" };
  }

  const types =
    options.types ??
    headers.map((_, colIdx) =>
      suggestColumnType(dataRows.map((r) => r[colIdx] ?? "")),
    );

  const columns = headers.map((name, i) => ({
    id: cryptoRandomId("col"),
    name: name.slice(0, 120),
    type: types[i] ?? ("text" as const),
    width: 160,
  }));

  const rows = dataRows.map((r) => ({
    id: cryptoRandomId("row"),
    cells: Object.fromEntries(
      columns.map((col, i) => {
        const raw = (r[i] ?? "").slice(0, MAX_KB_TABLE_CELL_CHARS);
        if (col.type === "boolean") {
          return [col.id, /^(true|1|yes)$/i.test(raw)];
        }
        if (col.type === "number") {
          const n = Number(raw.replace(",", "."));
          return [col.id, raw.trim() === "" || !Number.isFinite(n) ? null : n];
        }
        return [col.id, raw];
      }),
    ),
  }));

  const validated = validateKbTableDocument({ columns, rows });
  if (!validated.ok) {
    if (validated.error === "too_many_cells") return { ok: false, error: "too_many_cells" };
    if (validated.error === "too_many_rows") return { ok: false, error: "too_many_rows" };
    if (validated.error === "too_many_columns") return { ok: false, error: "too_many_columns" };
    if (validated.error === "cell_too_long") return { ok: false, error: "cell_too_long" };
    return { ok: false, error: "malformed" };
  }
  return { ok: true, data: validated.data };
}

export function documentToCsv(doc: KbTableDocument): string {
  const escape = (value: string) => {
    const safe = escapeCsvFormula(value);
    if (/[",\n\r;]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  };
  const header = doc.columns.map((c) => escape(c.name)).join(",");
  const lines = doc.rows.map((row) =>
    doc.columns
      .map((col) => {
        const v = row.cells[col.id];
        if (v === null || v === undefined) return "";
        return escape(String(v));
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}

/** Parse tab-separated clipboard from Excel / Google Sheets. */
export function parseClipboardTsv(
  text: string,
): { ok: true; matrix: string[][] } | { ok: false; error: CsvParseError } {
  if (text.length > MAX_KB_TABLE_CSV_BYTES) return { ok: false, error: "too_large" };
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) return { ok: false, error: "empty" };
  const matrix = normalized.split("\n").map((line) => line.split("\t"));
  while (
    matrix.length &&
    matrix[matrix.length - 1]!.length === 1 &&
    matrix[matrix.length - 1]![0] === ""
  ) {
    matrix.pop();
  }
  const width = Math.max(...matrix.map((r) => r.length), 0);
  if (width > MAX_KB_TABLE_COLUMNS) return { ok: false, error: "too_many_columns" };
  if (matrix.length > MAX_KB_TABLE_ROWS) return { ok: false, error: "too_many_rows" };
  if (matrix.length * width > MAX_KB_TABLE_CELLS) return { ok: false, error: "too_many_cells" };
  for (const r of matrix) {
    while (r.length < width) r.push("");
    for (const cell of r) {
      if (cell.length > MAX_KB_TABLE_CELL_CHARS) return { ok: false, error: "cell_too_long" };
    }
  }
  return { ok: true, matrix };
}
