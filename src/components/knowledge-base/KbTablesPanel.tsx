"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { KbTableGrid } from "@/components/knowledge-base/KbTableGrid";
import {
  emptyKbTableDocument,
  type KbTableDocument,
} from "@/lib/knowledge-base/table-limits";
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
  const [csvImporting, setCsvImporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<KbTableDocument | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const createInFlight = useRef(false);

  const active = tables.find((x) => x.id === activeId) ?? tables[0] ?? null;

  const resolveSlug = async (): Promise<string | null> => {
    if (ensureArticle) {
      try {
        return (await ensureArticle()).trim() || null;
      } catch (err) {
        if (err instanceof Error && err.message === "slug_taken") {
          setError(t("editor.errors.slugTaken"));
        } else {
          setError(t("attachments.prepareFailed"));
        }
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
      if (tablesRef.current.length === 0) {
        setError(t("tables.loadFailed"));
      }
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
      if (!uploadSlug) return;
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
      setEditing(true);
      setError(null);
      setSaveState("saved");
      if (uploadSlug) void load(uploadSlug);
    } finally {
      createInFlight.current = false;
    }
  };

  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  const flushSave = async (tableId: string, document: KbTableDocument): Promise<boolean> => {
    const table = tablesRef.current.find((x) => x.id === tableId);
    if (!table) return false;
    const saveSlug = slug.trim() || (await resolveSlug());
    if (!saveSlug) {
      setSaveState("error");
      return false;
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
      return false;
    }
    if (!res.ok) {
      setSaveState("error");
      setError(t("tables.saveFailed"));
      return false;
    }
    const data = (await res.json()) as { table: KbTableClient };
    setTables((prev) => prev.map((x) => (x.id === data.table.id ? data.table : x)));
    setSaveState("saved");
    setError(null);
    pendingDoc.current = null;
    return true;
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

  const importCsv = async (file: File) => {
    if (!shouldEnsureDraftForUpload(1) || csvImporting) return;
    setCsvImporting(true);
    setError(null);
    try {
      const uploadSlug = await resolveSlug();
      if (!uploadSlug) return;
      const body = new FormData();
      body.append("file", file);
      body.append("headerRow", "true");
      body.append("title", file.name.replace(/\.csv$/i, "") || t("tables.defaultTitle"));
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
      setEditing(false);
      setSaveState("saved");
    } finally {
      setCsvImporting(false);
    }
  };

  const saveAndClose = async () => {
    if (!active || !canManage) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const doc = pendingDoc.current ?? active.document;
    const ok = await flushSave(active.id, doc);
    if (ok) setEditing(false);
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
            disabled={csvImporting}
            onClick={() => csvInputRef.current?.click()}
          >
            {csvImporting ? t("tables.saving") : t("tables.importCsv")}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
              e.target.value = "";
            }}
          />
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
              onClick={() => {
                setActiveId(table.id);
                setEditing(false);
              }}
            >
              {table.title}
            </button>
          ))}
        </div>
      ) : null}

      {active ? (
        <>
          {canManage && editing ? (
            <>
              <p className={styles.meta}>{t("tables.editHint")}</p>
              <label className={styles.editorLabel}>
                {t("tables.tableTitlePrompt")}
                <input
                  className={styles.editorInput}
                  placeholder={t("tables.tableTitlePlaceholder")}
                  defaultValue={
                    active.title === t("tables.defaultTitle") ? "" : active.title
                  }
                  key={active.id}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    void onTitleBlur(next || t("tables.defaultTitle"));
                  }}
                />
              </label>
              <p className={styles.meta}>{t("tables.pasteHint")}</p>
            </>
          ) : (
            <div className={styles.fileActionRow}>
              <h4 className={styles.editorSectionTitle}>
                {active.title === t("tables.defaultTitle")
                  ? t("tables.newTable")
                  : active.title}
              </h4>
              {canManage ? (
                <button
                  type="button"
                  className={styles.fileActionBtn}
                  onClick={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  {t("tables.edit")}
                </button>
              ) : null}
            </div>
          )}

          {!editing ? (
            <label className={styles.editorLabel}>
              {t("tables.search")}
              <input
                className={styles.editorInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          ) : null}

          <KbTableGrid
            document={active.document}
            canEdit={Boolean(canManage && editing)}
            onChange={onDocumentChange}
            searchQuery={canManage && editing ? "" : search}
            sortColumnId={canManage && editing ? null : sortColumnId}
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
            {canManage && editing ? (
              <button
                type="button"
                className={styles.fileActionBtn}
                disabled={saveState === "saving"}
                onClick={() => void saveAndClose()}
              >
                {saveState === "saving" ? t("tables.saving") : t("tables.save")}
              </button>
            ) : null}
            <a
              className={styles.linkBtn}
              href={`/api/knowledge-base/${encodeURIComponent(slug)}/tables/${encodeURIComponent(active.id)}/export.csv`}
            >
              {t("tables.exportCsv")}
            </a>
            {canManage && editing ? (
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
