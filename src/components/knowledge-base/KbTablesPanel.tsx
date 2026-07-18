"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { KbTableGrid } from "@/components/knowledge-base/KbTableGrid";
import {
  KB_TABLE_COLUMN_TYPES,
  emptyKbTableDocument,
  type KbTableColumnType,
  type KbTableDocument,
} from "@/lib/knowledge-base/table-limits";
import { csvMatrixToDocument, parseCsvText } from "@/lib/knowledge-base/table-csv";
import { shouldEnsureDraftForUpload } from "@/lib/knowledge-base/kb-auto-draft";

import styles from "./KnowledgeBaseView.module.css";

export type KbTableClient = {
  id: string;
  title: string;
  description: string | null;
  document: KbTableDocument;
  revision: number;
  status: "active" | "archived";
  updatedAt: string;
};

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

type CsvPreviewState = {
  file: File;
  csvText: string;
  title: string;
  headerRow: boolean;
  types: KbTableColumnType[];
  columns: Array<{ name: string; type: KbTableColumnType }>;
  rowCount: number;
  sampleRows: KbTableDocument["rows"];
  document: KbTableDocument;
};

type Props = {
  slug: string;
  canManage: boolean;
  articlePersisted?: boolean;
  ensureArticle?: () => Promise<string>;
};

const CSV_ERROR_KEYS = new Set([
  "empty",
  "too_large",
  "too_many_rows",
  "too_many_columns",
  "too_many_cells",
  "cell_too_long",
  "malformed",
]);

function buildPreviewFromText(
  csvText: string,
  headerRow: boolean,
  types?: KbTableColumnType[],
):
  | {
      ok: true;
      columns: Array<{ name: string; type: KbTableColumnType }>;
      rowCount: number;
      sampleRows: KbTableDocument["rows"];
      document: KbTableDocument;
      types: KbTableColumnType[];
    }
  | { ok: false; error: string } {
  const parsed = parseCsvText(csvText);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const built = csvMatrixToDocument(parsed.data.matrix, { headerRow, types });
  if (!built.ok) return { ok: false, error: built.error };
  return {
    ok: true,
    columns: built.data.columns.map((c) => ({ name: c.name, type: c.type })),
    rowCount: built.data.rows.length,
    sampleRows: built.data.rows.slice(0, 5),
    document: built.data,
    types: built.data.columns.map((c) => c.type),
  };
}

export function KbTablesPanel({
  slug,
  canManage,
  articlePersisted = true,
  ensureArticle,
}: Props) {
  const t = useTranslations("knowledgeBase");
  const [tables, setTables] = useState<KbTableClient[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [search, setSearch] = useState("");
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [csvPreview, setCsvPreview] = useState<CsvPreviewState | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<KbTableDocument | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const createInFlight = useRef(false);

  const active = tables.find((x) => x.id === activeId) ?? tables[0] ?? null;

  const resolveSlug = async (): Promise<string | null> => {
    if (ensureArticle) {
      try {
        return (await ensureArticle()).trim() || null;
      } catch {
        return null;
      }
    }
    if (articlePersisted && slug.trim()) return slug.trim();
    return null;
  };

  const load = useCallback(async (loadSlug: string) => {
    if (!loadSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge-base/${encodeURIComponent(loadSlug)}/tables`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { tables: KbTableClient[] };
      const activeOnly = data.tables.filter((x) => x.status === "active");
      setTables(activeOnly);
      setActiveId((prev) =>
        prev && activeOnly.some((x) => x.id === prev) ? prev : activeOnly[0]?.id ?? null,
      );
    } catch {
      setError(t("tables.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (articlePersisted && slug.trim()) void load(slug);
  }, [articlePersisted, slug, load]);

  const mapCsvError = (code: string) =>
    CSV_ERROR_KEYS.has(code) ? t(`tables.errors.${code as "empty"}`) : t("tables.importFailed");

  const createEmpty = async () => {
    if (createInFlight.current) return;
    createInFlight.current = true;
    setError(null);
    try {
      const uploadSlug = await resolveSlug();
      if (!uploadSlug) {
        setError(t("attachments.prepareFailed"));
        return;
      }
      const res = await fetch(
        `/api/knowledge-base/${encodeURIComponent(uploadSlug)}/tables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t("tables.defaultTitle"),
            document: emptyKbTableDocument(3, 3),
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? t("tables.saveFailed"));
        return;
      }
      const data = (await res.json()) as { table: KbTableClient };
      setTables((prev) => [...prev, data.table]);
      setActiveId(data.table.id);
      setSaveState("saved");
    } finally {
      createInFlight.current = false;
    }
  };

  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  const flushSave = async (tableId: string, document: KbTableDocument) => {
    const table = tablesRef.current.find((x) => x.id === tableId);
    if (!table) return;
    const saveSlug = slug.trim() || (await resolveSlug());
    if (!saveSlug) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    const res = await fetch(
      `/api/knowledge-base/${encodeURIComponent(saveSlug)}/tables/${encodeURIComponent(tableId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document,
          expectedRevision: table.revision,
          title: table.title,
        }),
      },
    );
    if (res.status === 409) {
      setSaveState("conflict");
      setError(t("tables.conflict"));
      pendingDoc.current = document;
      return;
    }
    if (!res.ok) {
      setSaveState("error");
      setError(t("tables.saveFailed"));
      return;
    }
    const data = (await res.json()) as { table: KbTableClient };
    setTables((prev) => prev.map((x) => (x.id === data.table.id ? data.table : x)));
    setSaveState("saved");
    setError(null);
    pendingDoc.current = null;
  };

  const onDocumentChange = (document: KbTableDocument) => {
    if (!active || !canManage) return;
    const tableId = active.id;
    pendingDoc.current = document;
    setTables((prev) =>
      prev.map((x) => (x.id === tableId ? { ...x, document } : x)),
    );
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const latest = pendingDoc.current;
      if (latest) void flushSave(tableId, latest);
    }, 900);
  };

  const onTitleBlur = async (title: string) => {
    if (!active || !canManage) return;
    const res = await fetch(
      `/api/knowledge-base/${encodeURIComponent(slug)}/tables/${encodeURIComponent(active.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, expectedRevision: active.revision }),
      },
    );
    if (res.status === 409) {
      setSaveState("conflict");
      setError(t("tables.conflict"));
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { table: KbTableClient };
    setTables((prev) => prev.map((x) => (x.id === data.table.id ? data.table : x)));
  };

  const archiveActive = async () => {
    if (!active || !canManage) return;
    if (!window.confirm(t("tables.confirmArchive"))) return;
    const res = await fetch(
      `/api/knowledge-base/${encodeURIComponent(slug)}/tables/${encodeURIComponent(active.id)}/archive`,
      { method: "POST" },
    );
    if (!res.ok) {
      setError(t("tables.archiveFailed"));
      return;
    }
    await load(slug);
  };

  const openCsvPreview = async (file: File) => {
    if (!shouldEnsureDraftForUpload(1)) return;
    setError(null);
    const csvText = await file.text();
    const built = buildPreviewFromText(csvText, true);
    if (!built.ok) {
      setError(mapCsvError(built.error));
      return;
    }
    setCsvPreview({
      file,
      csvText,
      title: file.name.replace(/\.csv$/i, "") || t("tables.defaultTitle"),
      headerRow: true,
      types: built.types,
      columns: built.columns,
      rowCount: built.rowCount,
      sampleRows: built.sampleRows,
      document: built.document,
    });
  };

  const refreshCsvPreview = (
    csvText: string,
    file: File,
    headerRow: boolean,
    title: string,
    types?: KbTableColumnType[],
  ) => {
    const built = buildPreviewFromText(csvText, headerRow, types);
    if (!built.ok) {
      setError(mapCsvError(built.error));
      return;
    }
    setCsvPreview({
      file,
      csvText,
      title,
      headerRow,
      types: built.types,
      columns: built.columns,
      rowCount: built.rowCount,
      sampleRows: built.sampleRows,
      document: built.document,
    });
  };

  const confirmCsvImport = async () => {
    if (!csvPreview || csvImporting) return;
    setCsvImporting(true);
    setError(null);
    try {
      const uploadSlug = await resolveSlug();
      if (!uploadSlug) {
        setError(t("attachments.prepareFailed"));
        return;
      }
      const body = new FormData();
      body.append("file", csvPreview.file);
      body.append("headerRow", csvPreview.headerRow ? "true" : "false");
      body.append("title", csvPreview.title);
      body.append("types", JSON.stringify(csvPreview.types));
      const res = await fetch(
        `/api/knowledge-base/${encodeURIComponent(uploadSlug)}/tables/import-csv`,
        { method: "POST", body },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = data?.error;
        setError(code ? mapCsvError(String(code)) : t("tables.importFailed"));
        return;
      }
      const data = (await res.json()) as { table: KbTableClient };
      setTables((prev) => [...prev, data.table]);
      setActiveId(data.table.id);
      setCsvPreview(null);
      setSaveState("saved");
    } finally {
      setCsvImporting(false);
    }
  };

  const retrySave = () => {
    if (saveState === "conflict") {
      pendingDoc.current = null;
      const loadSlug = slug.trim();
      if (loadSlug) void load(loadSlug);
      setSaveState("idle");
      setError(null);
      return;
    }
    if (!active || !pendingDoc.current) return;
    void flushSave(active.id, pendingDoc.current);
  };

  const saveLabel =
    saveState === "saving"
      ? t("tables.saving")
      : saveState === "saved"
        ? t("tables.saved")
        : saveState === "error"
          ? t("tables.saveFailed")
          : saveState === "conflict"
            ? t("tables.conflict")
            : null;

  return (
    <div className={styles.attachmentsPanel} id="kb-tables-panel">
      <h3 className={styles.editorSectionTitle}>{t("tables.title")}</h3>
      <p className={styles.meta}>{t("tables.hint")}</p>

      {canManage ? (
        <div className={styles.fileActionRow}>
          <button type="button" className={styles.fileActionBtn} onClick={() => void createEmpty()}>
            {t("tables.createEmpty")}
          </button>
          <button
            type="button"
            className={styles.fileActionBtn}
            onClick={() => csvInputRef.current?.click()}
          >
            {t("tables.importCsv")}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openCsvPreview(file);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {csvPreview ? (
        <div className={styles.csvPreviewPanel}>
          <h4 className={styles.editorSectionTitle}>{t("tables.csvPreviewTitle")}</h4>
          <p className={styles.meta}>
            {t("tables.csvPreviewColumns", { count: csvPreview.columns.length })} ·{" "}
            {t("tables.csvPreviewRows", { count: csvPreview.rowCount })}
          </p>
          <label className={styles.editorLabel}>
            <span>
              <input
                type="checkbox"
                checked={csvPreview.headerRow}
                onChange={(e) => {
                  refreshCsvPreview(
                    csvPreview.csvText,
                    csvPreview.file,
                    e.target.checked,
                    csvPreview.title,
                  );
                }}
              />{" "}
              {t("tables.csvHeaderRow")}
            </span>
          </label>
          <div className={styles.csvTypeList}>
            {csvPreview.columns.map((col, i) => (
              <label key={`${col.name}-${i}`} className={styles.editorLabel}>
                {col.name}
                <select
                  className={styles.editorInput}
                  value={csvPreview.types[i] ?? col.type}
                  onChange={(e) => {
                    const nextTypes = [...csvPreview.types];
                    nextTypes[i] = e.target.value as KbTableColumnType;
                    refreshCsvPreview(
                      csvPreview.csvText,
                      csvPreview.file,
                      csvPreview.headerRow,
                      csvPreview.title,
                      nextTypes,
                    );
                  }}
                >
                  {KB_TABLE_COLUMN_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`tables.types.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className={styles.meta}>{t("tables.csvSample")}</p>
          <div className={styles.tableScroll}>
            <table className={styles.kbDataTable}>
              <thead>
                <tr>
                  {csvPreview.columns.map((col, i) => (
                    <th key={`${col.name}-h-${i}`}>{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.sampleRows.map((row) => (
                  <tr key={row.id}>
                    {csvPreview.document.columns.map((col) => (
                      <td key={col.id}>{String(row.cells[col.id] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.fileActionRow}>
            <button
              type="button"
              className={styles.fileActionBtn}
              disabled={csvImporting}
              onClick={() => void confirmCsvImport()}
            >
              {t("tables.csvConfirmImport")}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={csvImporting}
              onClick={() => setCsvPreview(null)}
            >
              {t("tables.csvCancelImport")}
            </button>
          </div>
        </div>
      ) : null}

      {saveLabel ? <p className={styles.meta}>{saveLabel}</p> : null}
      {saveState === "error" ? (
        <button type="button" className={styles.linkBtn} onClick={retrySave}>
          {t("tables.retrySave")}
        </button>
      ) : null}
      {saveState === "conflict" ? (
        <button type="button" className={styles.linkBtn} onClick={retrySave}>
          {t("tables.reloadTable")}
        </button>
      ) : null}
      {error ? <p className={styles.editorError}>{error}</p> : null}
      {loading ? <p className={styles.meta}>{t("loading.article")}</p> : null}

      {tables.length > 1 ? (
        <div className={styles.fileActionRow}>
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              className={table.id === active?.id ? styles.primaryBtn : styles.linkBtn}
              onClick={() => setActiveId(table.id)}
            >
              {table.title}
            </button>
          ))}
        </div>
      ) : null}

      {active ? (
        <>
          {canManage ? (
            <label className={styles.editorLabel}>
              {t("tables.tableTitle")}
              <input
                className={styles.editorInput}
                defaultValue={active.title}
                key={active.id}
                onBlur={(e) => void onTitleBlur(e.target.value)}
              />
            </label>
          ) : (
            <h4 className={styles.editorSectionTitle}>{active.title}</h4>
          )}

          {!canManage ? (
            <label className={styles.editorLabel}>
              {t("tables.search")}
              <input
                className={styles.editorInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          ) : (
            <p className={styles.meta}>{t("tables.pasteHint")}</p>
          )}

          <KbTableGrid
            document={active.document}
            canEdit={canManage}
            onChange={onDocumentChange}
            searchQuery={canManage ? "" : search}
            sortColumnId={canManage ? null : sortColumnId}
            sortDir={sortDir}
            onSortChange={(id) => {
              if (sortColumnId === id) {
                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              } else {
                setSortColumnId(id);
                setSortDir("asc");
              }
            }}
          />

          <div className={styles.fileActionRow}>
            <a
              className={styles.linkBtn}
              href={`/api/knowledge-base/${encodeURIComponent(slug)}/tables/${encodeURIComponent(active.id)}/export.csv`}
            >
              {t("tables.exportCsv")}
            </a>
            {canManage ? (
              <button type="button" className={styles.linkBtn} onClick={() => void archiveActive()}>
                {t("tables.archive")}
              </button>
            ) : null}
          </div>
        </>
      ) : !loading && !canManage ? (
        <p className={styles.meta}>{t("tables.none")}</p>
      ) : null}
    </div>
  );
}
