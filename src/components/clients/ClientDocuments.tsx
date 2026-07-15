"use client";

import { useTranslations } from "next-intl";
import type { ClientDocument } from "@/lib/google-sheets/types";
import styles from "./ClientDocuments.module.css";

type ClientDocumentsProps = {
  documents: ClientDocument[];
  source: "postgresql" | "google_sheets" | "demo";
};

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocuments({ documents, source }: ClientDocumentsProps) {
  const t = useTranslations("clients.documents");
  const tTypes = useTranslations("clients.documentTypes");
  const tStatuses = useTranslations("clients.documentStatuses");
  const tStorage = useTranslations("clients.documentStorage");

  return (
    <div className={styles.wrap}>
      {documents.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((doc) => {
            const typeKey = doc.documentType ?? doc.category;
            const statusKey = doc.status ?? "uploaded";
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
              </li>
            );
          })}
        </ul>
      )}

      {source === "postgresql" ? (
        <p className={styles.uploadHint}>{t("uploadHint")}</p>
      ) : null}
    </div>
  );
}
