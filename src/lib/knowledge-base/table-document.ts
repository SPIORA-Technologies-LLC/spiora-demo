import {
  KB_TABLE_COLUMN_TYPES,
  MAX_KB_TABLE_CELL_CHARS,
  MAX_KB_TABLE_CELLS,
  MAX_KB_TABLE_COLUMNS,
  MAX_KB_TABLE_JSON_BYTES,
  MAX_KB_TABLE_ROWS,
  MAX_KB_TABLE_DESCRIPTION_CHARS,
  MAX_KB_TABLE_TITLE_CHARS,
  type KbTableCellValue,
  type KbTableColumn,
  type KbTableColumnType,
  type KbTableDocument,
  type KbTableRow,
  countKbTableCells,
  isSafeHttpUrl,
} from "./table-limits";

export type KbTableValidateError =
  | "invalid_payload"
  | "too_many_rows"
  | "too_many_columns"
  | "too_many_cells"
  | "cell_too_long"
  | "duplicate_column_id"
  | "duplicate_row_id"
  | "unknown_column_ref"
  | "invalid_type"
  | "invalid_value"
  | "unsafe_url"
  | "title_invalid"
  | "description_invalid"
  | "payload_too_large";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isColumnType(value: unknown): value is KbTableColumnType {
  return (
    typeof value === "string" &&
    (KB_TABLE_COLUMN_TYPES as readonly string[]).includes(value)
  );
}

function normalizeCellValue(
  type: KbTableColumnType,
  raw: unknown,
): { ok: true; value: KbTableCellValue } | { ok: false; error: KbTableValidateError } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: type === "boolean" ? false : type === "number" ? null : "" };
  }

  switch (type) {
    case "text": {
      if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
        return { ok: false, error: "invalid_value" };
      }
      const text = String(raw);
      if (text.length > MAX_KB_TABLE_CELL_CHARS) return { ok: false, error: "cell_too_long" };
      return { ok: true, value: text };
    }
    case "number": {
      if (typeof raw === "number" && Number.isFinite(raw)) return { ok: true, value: raw };
      if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
        return { ok: true, value: Number(raw) };
      }
      return { ok: false, error: "invalid_value" };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === "1" || raw === 1) return { ok: true, value: true };
      if (raw === "false" || raw === "0" || raw === 0) return { ok: true, value: false };
      return { ok: false, error: "invalid_value" };
    }
    case "date": {
      if (typeof raw !== "string") return { ok: false, error: "invalid_value" };
      const text = raw.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false, error: "invalid_value" };
      if (text.length > MAX_KB_TABLE_CELL_CHARS) return { ok: false, error: "cell_too_long" };
      return { ok: true, value: text };
    }
    case "url": {
      if (typeof raw !== "string") return { ok: false, error: "invalid_value" };
      const text = raw.trim();
      if (text.length > MAX_KB_TABLE_CELL_CHARS) return { ok: false, error: "cell_too_long" };
      if (text && !isSafeHttpUrl(text)) return { ok: false, error: "unsafe_url" };
      return { ok: true, value: text };
    }
    default:
      return { ok: false, error: "invalid_type" };
  }
}

export function validateKbTableDocument(
  input: unknown,
): { ok: true; data: KbTableDocument } | { ok: false; error: KbTableValidateError } {
  if (!isPlainObject(input)) return { ok: false, error: "invalid_payload" };
  if (!Array.isArray(input.columns) || !Array.isArray(input.rows)) {
    return { ok: false, error: "invalid_payload" };
  }

  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_KB_TABLE_JSON_BYTES) {
    return { ok: false, error: "payload_too_large" };
  }

  if (input.columns.length > MAX_KB_TABLE_COLUMNS) {
    return { ok: false, error: "too_many_columns" };
  }
  if (input.rows.length > MAX_KB_TABLE_ROWS) {
    return { ok: false, error: "too_many_rows" };
  }

  const columnIds = new Set<string>();
  const columns: KbTableColumn[] = [];

  for (const col of input.columns) {
    if (!isPlainObject(col)) return { ok: false, error: "invalid_payload" };
    const id = typeof col.id === "string" ? col.id.trim() : "";
    const name = typeof col.name === "string" ? col.name.trim() : "";
    if (!id || id.length > 80) return { ok: false, error: "invalid_payload" };
    if (!name || name.length > 120) return { ok: false, error: "invalid_payload" };
    if (!isColumnType(col.type)) return { ok: false, error: "invalid_type" };
    if (columnIds.has(id)) return { ok: false, error: "duplicate_column_id" };
    columnIds.add(id);
    const width =
      typeof col.width === "number" && Number.isFinite(col.width)
        ? Math.min(Math.max(Math.round(col.width), 80), 480)
        : 160;
    columns.push({ id, name, type: col.type, width });
  }

  if (input.rows.length * columns.length > MAX_KB_TABLE_CELLS) {
    return { ok: false, error: "too_many_cells" };
  }

  const rowIds = new Set<string>();
  const rows: KbTableRow[] = [];

  for (const row of input.rows) {
    if (!isPlainObject(row)) return { ok: false, error: "invalid_payload" };
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id || id.length > 80) return { ok: false, error: "invalid_payload" };
    if (rowIds.has(id)) return { ok: false, error: "duplicate_row_id" };
    rowIds.add(id);

    if (!isPlainObject(row.cells)) return { ok: false, error: "invalid_payload" };
    const cells: Record<string, KbTableCellValue> = {};

    for (const key of Object.keys(row.cells)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return { ok: false, error: "invalid_payload" };
      }
      if (!columnIds.has(key)) return { ok: false, error: "unknown_column_ref" };
    }

    for (const col of columns) {
      const normalized = normalizeCellValue(col.type, row.cells[col.id]);
      if (!normalized.ok) return normalized;
      cells[col.id] = normalized.value;
    }

    rows.push({ id, cells });
  }

  const data = { columns, rows };
  if (countKbTableCells(data) > MAX_KB_TABLE_CELLS) {
    return { ok: false, error: "too_many_cells" };
  }

  return { ok: true, data };
}

export function validateKbTableTitle(
  title: unknown,
): { ok: true; title: string } | { ok: false; error: KbTableValidateError } {
  if (typeof title !== "string") return { ok: false, error: "title_invalid" };
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_KB_TABLE_TITLE_CHARS) {
    return { ok: false, error: "title_invalid" };
  }
  return { ok: true, title: trimmed };
}

export function validateKbTableDescription(
  description: unknown,
): { ok: true; description: string | null } | { ok: false; error: KbTableValidateError } {
  if (description === null || description === undefined) {
    return { ok: true, description: null };
  }
  if (typeof description !== "string") return { ok: false, error: "description_invalid" };
  const trimmed = description.trim();
  if (!trimmed) return { ok: true, description: null };
  if (trimmed.length > MAX_KB_TABLE_DESCRIPTION_CHARS) {
    return { ok: false, error: "description_invalid" };
  }
  return { ok: true, description: trimmed };
}

export function suggestColumnType(samples: string[]): KbTableColumnType {
  const nonEmpty = samples.map((s) => s.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every((s) => /^(true|false|0|1|yes|no)$/i.test(s))) return "boolean";
  if (nonEmpty.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))) return "date";
  if (nonEmpty.every((s) => Number.isFinite(Number(s.replace(",", "."))))) return "number";
  if (nonEmpty.every((s) => isSafeHttpUrl(s))) return "url";
  return "text";
}
