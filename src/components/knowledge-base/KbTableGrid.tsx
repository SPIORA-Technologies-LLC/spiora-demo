"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MAX_KB_TABLE_CELLS,
  MAX_KB_TABLE_COLUMNS,
  MAX_KB_TABLE_ROWS,
  KB_TABLE_COLUMN_TYPES,
  cryptoRandomId,
  isSafeHttpUrl,
  type KbTableCellValue,
  type KbTableColumnType,
  type KbTableDocument,
} from "@/lib/knowledge-base/table-limits";
import { parseClipboardTsv } from "@/lib/knowledge-base/table-csv";

import styles from "./KnowledgeBaseView.module.css";

type Props = {
  document: KbTableDocument;
  canEdit: boolean;
  onChange?: (next: KbTableDocument) => void;
  searchQuery?: string;
  sortColumnId?: string | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (columnId: string) => void;
};

function cellKey(rowId: string, colId: string) {
  return `${rowId}:${colId}`;
}

export function KbTableGrid({
  document,
  canEdit,
  onChange,
  searchQuery = "",
  sortColumnId = null,
  sortDir = "asc",
  onSortChange,
}: Props) {
  const t = useTranslations("knowledgeBase");
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const [undoDoc, setUndoDoc] = useState<KbTableDocument | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const displayRows = useMemo(() => {
    let rows = [...document.rows];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        document.columns.some((col) =>
          String(row.cells[col.id] ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    }
    if (sortColumnId) {
      const col = document.columns.find((c) => c.id === sortColumnId);
      rows.sort((a, b) => {
        const av = a.cells[sortColumnId];
        const bv = b.cells[sortColumnId];
        const as = av == null ? "" : String(av);
        const bs = bv == null ? "" : String(bv);
        if (col?.type === "number") {
          const an = typeof av === "number" ? av : Number(as);
          const bn = typeof bv === "number" ? bv : Number(bs);
          return sortDir === "asc" ? an - bn : bn - an;
        }
        return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
      });
    }
    return rows;
  }, [document, searchQuery, sortColumnId, sortDir]);

  const commit = useCallback(
    (next: KbTableDocument, recordUndo = false) => {
      if (!canEdit || !onChange) return;
      if (recordUndo) setUndoDoc(document);
      onChange(next);
    },
    [canEdit, onChange, document],
  );

  const updateCell = (rowId: string, colId: string, value: KbTableCellValue) => {
    commit({
      ...document,
      rows: document.rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r,
      ),
    });
  };

  const addRow = () => {
    if (document.rows.length >= MAX_KB_TABLE_ROWS) return;
    if ((document.rows.length + 1) * document.columns.length > MAX_KB_TABLE_CELLS) return;
    const cells = Object.fromEntries(document.columns.map((c) => [c.id, c.type === "boolean" ? false : ""]));
    commit({
      ...document,
      rows: [...document.rows, { id: cryptoRandomId("row"), cells }],
    });
  };

  const deleteRow = (rowId: string) => {
    commit({ ...document, rows: document.rows.filter((r) => r.id !== rowId) }, true);
  };

  const addColumn = () => {
    if (document.columns.length >= MAX_KB_TABLE_COLUMNS) return;
    if (document.rows.length * (document.columns.length + 1) > MAX_KB_TABLE_CELLS) return;
    const col = {
      id: cryptoRandomId("col"),
      name: `Column ${document.columns.length + 1}`,
      type: "text" as const,
      width: 160,
    };
    commit({
      columns: [...document.columns, col],
      rows: document.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: "" } })),
    });
  };

  const deleteColumn = (colId: string) => {
    if (document.columns.length <= 1) return;
    commit(
      {
        columns: document.columns.filter((c) => c.id !== colId),
        rows: document.rows.map((r) => {
          const { [colId]: _, ...rest } = r.cells;
          return { ...r, cells: rest };
        }),
      },
      true,
    );
  };

  const renameColumn = (colId: string, name: string) => {
    commit({
      ...document,
      columns: document.columns.map((c) => (c.id === colId ? { ...c, name } : c)),
    });
  };

  const changeType = (colId: string, type: KbTableColumnType) => {
    commit({
      columns: document.columns.map((c) => (c.id === colId ? { ...c, type } : c)),
      rows: document.rows.map((r) => {
        const raw = r.cells[colId];
        let next: KbTableCellValue = "";
        if (type === "boolean") next = Boolean(raw);
        else if (type === "number") {
          const n = typeof raw === "number" ? raw : Number(raw);
          next = Number.isFinite(n) ? n : null;
        } else next = raw == null ? "" : String(raw);
        return { ...r, cells: { ...r.cells, [colId]: next } };
      }),
    });
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (!canEdit || !onChange) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const parsed = parseClipboardTsv(text);
    if (!parsed.ok) {
      window.alert(t(`tables.errors.${parsed.error}`));
      return;
    }
    const matrix = parsed.matrix;
    const startRow = active?.row ?? 0;
    const startCol = active?.col ?? 0;
    let columns = [...document.columns];
    let rows = [...document.rows];

    const needCols = startCol + matrix[0]!.length;
    while (columns.length < needCols && columns.length < MAX_KB_TABLE_COLUMNS) {
      const col = {
        id: cryptoRandomId("col"),
        name: `Column ${columns.length + 1}`,
        type: "text" as const,
        width: 160,
      };
      columns.push(col);
      rows = rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: "" } }));
    }
    const needRows = startRow + matrix.length;
    while (rows.length < needRows && rows.length < MAX_KB_TABLE_ROWS) {
      rows.push({
        id: cryptoRandomId("row"),
        cells: Object.fromEntries(columns.map((c) => [c.id, ""])),
      });
    }
    if (needRows > MAX_KB_TABLE_ROWS || needCols > MAX_KB_TABLE_COLUMNS) {
      window.alert(t("tables.errors.too_many_cells"));
      return;
    }
    if (rows.length * columns.length > MAX_KB_TABLE_CELLS) {
      window.alert(t("tables.errors.too_many_cells"));
      return;
    }

    for (let ri = 0; ri < matrix.length; ri++) {
      for (let ci = 0; ci < matrix[ri]!.length; ci++) {
        const row = rows[startRow + ri];
        const col = columns[startCol + ci];
        if (!row || !col) continue;
        row.cells[col.id] = matrix[ri]![ci] ?? "";
      }
    }
    commit({ columns, rows }, true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!active) return;
    const { row, col } = active;
    if (e.key === "Tab") {
      e.preventDefault();
      const nextCol = e.shiftKey ? col - 1 : col + 1;
      if (nextCol >= 0 && nextCol < document.columns.length) {
        setActive({ row, col: nextCol });
      } else if (!e.shiftKey && row + 1 < displayRows.length) {
        setActive({ row: row + 1, col: 0 });
      } else if (e.shiftKey && row > 0) {
        setActive({ row: row - 1, col: document.columns.length - 1 });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (row + 1 < displayRows.length) setActive({ row: row + 1, col });
    } else if (e.key === "z" && (e.metaKey || e.ctrlKey) && undoDoc) {
      e.preventDefault();
      onChange?.(undoDoc);
      setUndoDoc(null);
    }
  };

  if (!document.columns.length) {
    return <p className={styles.meta}>{t("tables.empty")}</p>;
  }

  return (
    <div className={styles.tableGridWrap} onPaste={onPaste} onKeyDown={onKeyDown} ref={tableRef}>
      <div className={styles.tableScroll}>
        <table className={styles.kbDataTable}>
          <thead>
            <tr>
              {canEdit ? <th className={styles.kbTableCorner} /> : null}
              {document.columns.map((col, colIdx) => (
                <th key={col.id} style={{ minWidth: col.width ?? 160 }}>
                  {canEdit ? (
                    <div className={styles.kbColHeader}>
                      <input
                        className={styles.editorInput}
                        value={col.name}
                        aria-label={t("tables.columnName")}
                        onChange={(e) => renameColumn(col.id, e.target.value)}
                      />
                      <select
                        className={styles.editorSelect}
                        value={col.type}
                        aria-label={t("tables.columnType")}
                        onChange={(e) =>
                          changeType(col.id, e.target.value as KbTableColumnType)
                        }
                      >
                        {KB_TABLE_COLUMN_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`tables.types.${type}`)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => deleteColumn(col.id)}
                      >
                        {t("tables.deleteColumn")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => onSortChange?.(col.id)}
                    >
                      {col.name}
                      {sortColumnId === col.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={row.id}>
                {canEdit ? (
                  <td>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => deleteRow(row.id)}
                    >
                      ×
                    </button>
                  </td>
                ) : null}
                {document.columns.map((col, colIdx) => {
                  const value = row.cells[col.id];
                  const focused = active?.row === rowIdx && active?.col === colIdx;
                  return (
                    <td
                      key={cellKey(row.id, col.id)}
                      className={focused ? styles.kbCellActive : undefined}
                      onClick={() => setActive({ row: rowIdx, col: colIdx })}
                    >
                      {renderCell({
                        canEdit,
                        type: col.type,
                        value,
                        onChange: (v) => updateCell(row.id, col.id, v),
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className={styles.fileActionRow}>
          <button type="button" className={styles.fileActionBtn} onClick={addRow}>
            {t("tables.addRow")}
          </button>
          <button type="button" className={styles.fileActionBtn} onClick={addColumn}>
            {t("tables.addColumn")}
          </button>
          {undoDoc ? (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                onChange?.(undoDoc);
                setUndoDoc(null);
              }}
            >
              {t("tables.undoPaste")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function renderCell(opts: {
  canEdit: boolean;
  type: KbTableColumnType;
  value: KbTableCellValue | undefined;
  onChange: (v: KbTableCellValue) => void;
}) {
  const { canEdit, type, value, onChange } = opts;
  if (type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        disabled={!canEdit}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  if (!canEdit) {
    if (type === "url" && typeof value === "string" && isSafeHttpUrl(value)) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      );
    }
    return <span>{value == null ? "" : String(value)}</span>;
  }
  if (type === "date") {
    return (
      <input
        type="date"
        className={styles.editorInput}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "number") {
    return (
      <input
        type="number"
        className={styles.editorInput}
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    );
  }
  return (
    <input
      type="text"
      className={styles.editorInput}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      inputMode={type === "url" ? "url" : "text"}
    />
  );
}
