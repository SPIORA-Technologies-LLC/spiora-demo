"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import {
  KB_ATTACHMENT_ACCEPT,
  formatKbFileSize,
} from "@/lib/knowledge-base/attachment-formats";

import styles from "./KnowledgeBaseView.module.css";

export type KbAttachmentClient = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  caption: string | null;
  sortOrder: number;
  isPrimary: boolean;
  status: "active" | "archived";
  url: string;
  kind: "pdf" | "image";
};

type Props = {
  slug: string;
  canManage: boolean;
  /** When true, article must already exist (edit/create after first save). */
  enabled: boolean;
};

export function KbAttachmentsPanel({ slug, canManage, enabled }: Props) {
  const t = useTranslations("knowledgeBase");
  const locale = useLocale() as AppLocale;
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<KbAttachmentClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge-base/${encodeURIComponent(slug)}/attachments`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { attachments: KbAttachmentClient[] };
      setItems(data.attachments.filter((a) => a.status === "active"));
    } catch {
      setError(t("attachments.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [enabled, slug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!canManage || !enabled) return;
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(
          `/api/knowledge-base/${encodeURIComponent(slug)}/attachments`,
          { method: "POST", body },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? t("attachments.uploadFailed"));
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachments.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const archive = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm(t("attachments.confirmArchive"))) return;
    setError(null);
    const res = await fetch(
      `/api/knowledge-base/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      },
    );
    if (!res.ok) {
      setError(t("attachments.archiveFailed"));
      return;
    }
    await load();
  };

  const saveCaption = async (id: string, caption: string) => {
    if (!canManage) return;
    const res = await fetch(
      `/api/knowledge-base/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      },
    );
    if (!res.ok) {
      setError(t("attachments.updateFailed"));
      return;
    }
    await load();
  };

  if (!enabled) {
    return (
      <div className={styles.attachmentsPanel}>
        <h3 className={styles.editorSectionTitle}>{t("attachments.title")}</h3>
        <p className={styles.meta}>{t("attachments.saveDraftFirst")}</p>
      </div>
    );
  }

  const preview = items.find((i) => i.id === previewId) ?? null;

  return (
    <div className={styles.attachmentsPanel}>
      <h3 className={styles.editorSectionTitle}>{t("attachments.title")}</h3>
      <p className={styles.meta}>{t("attachments.hint")}</p>

      {canManage ? (
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={KB_ATTACHMENT_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={styles.linkBtn}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? t("attachments.uploading") : t("attachments.addFiles")}
          </button>
          <p className={styles.meta}>{t("attachments.dropHint")}</p>
        </div>
      ) : null}

      {error ? <p className={styles.editorError}>{error}</p> : null}
      {loading ? <p className={styles.meta}>{t("loading.article")}</p> : null}

      <ul className={styles.attachmentList}>
        {items.map((item) => (
          <li key={item.id} className={styles.attachmentItem}>
            <div className={styles.attachmentMeta}>
              <strong>{item.fileName}</strong>
              <span className={styles.meta}>
                {item.kind.toUpperCase()} · {formatKbFileSize(item.fileSize, locale)}
              </span>
              {canManage ? (
                <input
                  className={styles.editorInput}
                  defaultValue={item.caption ?? ""}
                  placeholder={t("attachments.captionPlaceholder")}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next !== (item.caption ?? "")) {
                      void saveCaption(item.id, next);
                    }
                  }}
                />
              ) : item.caption ? (
                <span className={styles.meta}>{item.caption}</span>
              ) : null}
            </div>
            <div className={styles.attachmentActions}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setPreviewId(item.id)}
              >
                {t("attachments.preview")}
              </button>
              <a className={styles.linkBtn} href={`${item.url}?disposition=attachment`}>
                {t("attachments.download")}
              </a>
              {canManage ? (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => void archive(item.id)}
                >
                  {t("attachments.archive")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {preview ? (
        <div className={styles.attachmentPreview}>
          <div className={styles.previewTabs}>
            <span>{preview.fileName}</span>
            <button type="button" className={styles.linkBtn} onClick={() => setPreviewId(null)}>
              {t("attachments.closePreview")}
            </button>
          </div>
          {preview.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${preview.url}?disposition=inline`}
              alt={preview.caption || preview.fileName}
              className={styles.attachmentImage}
            />
          ) : (
            <iframe
              title={preview.fileName}
              src={`${preview.url}?disposition=inline`}
              className={styles.attachmentPdf}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
