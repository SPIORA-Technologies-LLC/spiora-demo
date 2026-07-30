"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { canCreateClientDocument } from "@/lib/clients/client-data-permissions";
import type { ClientDocument } from "@/lib/google-sheets/types";
import styles from "./ClientDocuments.module.css";

type ClientDocumentsProps = {
  clientId: string;
  documents: ClientDocument[];
  source: "postgresql" | "google_sheets" | "demo";
};

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canOpenDocument(doc: ClientDocument): boolean {
  return doc.storageState === "supabase";
}

export function ClientDocuments({
  clientId,
  documents: initialDocuments,
  source,
}: ClientDocumentsProps) {
  const t = useTranslations("clients.documents");
  const tTypes = useTranslations("clients.documentTypes");
  const tStatuses = useTranslations("clients.documentStatuses");
  const tStorage = useTranslations("clients.documentStorage");
  const session = useSession();
  const canUpload = canCreateClientDocument(session) && source === "postgresql";
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/documents`);
    if (!res.ok) return;
    const data = (await res.json()) as { documents: ClientDocument[] };
    setDocuments(data.documents);
  }

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("documentType", "other");
      const res = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/documents`,
        { method: "POST", body: form },
      );
      if (!res.ok) {
        setError(t("uploadFailed"));
        return;
      }
      await refresh();
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={styles.wrap}>
      {canUpload ? (
        <div className={styles.uploadRow}>
          <label className={styles.uploadBtn}>
            <input
              ref={inputRef}
              type="file"
              className={styles.fileInput}
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onUpload(file);
              }}
            />
            {uploading ? t("uploading") : t("upload")}
          </label>
          <p className={styles.uploadHint}>{t("uploadFormats")}</p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {documents.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((doc) => {
            const typeKey = doc.documentType ?? doc.category ?? "other";
            const statusKey = doc.status ?? "uploaded";
            const openUrl = `/api/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(doc.id)}?inline=1`;
            const downloadUrl = `/api/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(doc.id)}`;
            const openable = canOpenDocument(doc);
            return (
              <li key={doc.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.fileName}>{doc.name}</span>
                  <span className={styles.badge}>
                    {tStorage(doc.storageState ?? "demo")}
                  </span>
                </div>
                <div className={styles.meta}>
                  <span>{tTypes(typeKey)}</span>
                  <span>{tStatuses(statusKey)}</span>
                  <span>{formatSize(doc.sizeBytes)}</span>
                </div>
                <div className={styles.metaSecondary}>
                  <span>{doc.uploadedByName ?? "—"}</span>
                  <span>{doc.uploadedAt}</span>
                </div>
                {openable ? (
                  <div className={styles.actions}>
                    <a
                      className={styles.actionLink}
                      href={openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("open")}
                    </a>
                    <a className={styles.actionLink} href={downloadUrl}>
                      {t("download")}
                    </a>
                  </div>
                ) : (
                  <p className={styles.unavailable}>{t("fileUnavailable")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
