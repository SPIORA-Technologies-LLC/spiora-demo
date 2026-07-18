"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import {
  KB_ATTACHMENT_ACCEPT,
  KB_AUDIO_ACCEPT,
  KB_IMAGE_ACCEPT,
  KB_PDF_ACCEPT,
  KB_VIDEO_ACCEPT,
  MAX_KB_AUDIO_RECORD_MS,
  formatKbFileSize,
  type KbAttachmentKind,
} from "@/lib/knowledge-base/attachment-formats";
import { shouldEnsureDraftForUpload } from "@/lib/knowledge-base/kb-auto-draft";
import {
  formatKbRecordDuration,
  useKbAudioRecorder,
} from "@/components/knowledge-base/useKbAudioRecorder";

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
  kind: KbAttachmentKind;
};

type Props = {
  slug: string;
  canManage: boolean;
  /** When false, slug may be a local draft slug — do not list/upload against it until ensureArticle. */
  articlePersisted?: boolean;
  /**
   * Ensures a persisted article exists and returns its slug.
   * Used on create flow before the first upload (Auto Draft).
   */
  ensureArticle?: () => Promise<string>;
};

export function KbAttachmentsPanel({
  slug,
  canManage,
  articlePersisted = true,
  ensureArticle,
}: Props) {
  const t = useTranslations("knowledgeBase");
  const locale = useLocale() as AppLocale;
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const anyInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<KbAttachmentClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const recorder = useKbAudioRecorder();
  const autoStopRef = useRef(false);

  const canUseSlug = articlePersisted && Boolean(slug.trim());

  const load = useCallback(async (loadSlug: string) => {
    if (!loadSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge-base/${encodeURIComponent(loadSlug)}/attachments`,
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
  }, [t]);

  useEffect(() => {
    if (canUseSlug) void load(slug);
  }, [canUseSlug, slug, load]);

  const resolveSlugForUpload = async (): Promise<string | null> => {
    // Prefer ensureArticle whenever provided — local slug alone is not enough
    // (title blur / slugify can set a slug before the row exists in Postgres).
    if (ensureArticle) {
      try {
        return (await ensureArticle()).trim() || null;
      } catch {
        return null;
      }
    }
    if (canUseSlug) return slug.trim();
    return null;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!canManage) return;
    const list = Array.from(files);
    if (!shouldEnsureDraftForUpload(list.length)) return;

    setUploading(true);
    setError(null);
    try {
      const uploadSlug = await resolveSlugForUpload();
      if (!uploadSlug) {
        setError(
          ensureArticle
            ? t("attachments.prepareFailed")
            : t("attachments.saveAfterFirst"),
        );
        return;
      }

      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(
          `/api/knowledge-base/${encodeURIComponent(uploadSlug)}/attachments`,
          { method: "POST", body },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          const raw = data?.error ?? "";
          if (/not found/i.test(raw)) {
            throw new Error(t("attachments.prepareFailed"));
          }
          throw new Error(raw || t("attachments.uploadFailed"));
        }
      }
      await load(uploadSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachments.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const saveRecording = useCallback(async () => {
    if (!canManage || recorder.state !== "recording") return;
    setError(null);
    recorder.clearError();

    const recording = await recorder.stopAndGetBlob();
    if (!recording) {
      setError(t("attachments.recorder.empty"));
      return;
    }

    recorder.setUploading(true);
    try {
      let uploadSlug: string | null = null;
      if (ensureArticle) {
        try {
          uploadSlug = (await ensureArticle()).trim() || null;
        } catch {
          uploadSlug = null;
        }
      } else if (canUseSlug) {
        uploadSlug = slug.trim();
      }

      if (!uploadSlug) {
        setError(
          ensureArticle
            ? t("attachments.prepareFailed")
            : t("attachments.saveAfterFirst"),
        );
        return;
      }

      const file = new File([recording.blob], recording.fileName, {
        type: recording.mimeType.split(";")[0]?.trim() || "audio/webm",
      });
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(
        `/api/knowledge-base/${encodeURIComponent(uploadSlug)}/attachments`,
        { method: "POST", body },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || t("attachments.uploadFailed"));
      }
      await load(uploadSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachments.uploadFailed"));
    } finally {
      recorder.setUploading(false);
    }
  }, [
    canManage,
    canUseSlug,
    ensureArticle,
    load,
    recorder.clearError,
    recorder.setUploading,
    recorder.state,
    recorder.stopAndGetBlob,
    slug,
    t,
  ]);

  useEffect(() => {
    if (recorder.state !== "recording") {
      autoStopRef.current = false;
      return;
    }
    if (recorder.elapsedMs < MAX_KB_AUDIO_RECORD_MS || autoStopRef.current) return;
    autoStopRef.current = true;
    void saveRecording();
  }, [recorder.elapsedMs, recorder.state, saveRecording]);

  const archive = async (id: string) => {
    if (!canManage || !slug) return;
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
    await load(slug);
  };

  const saveCaption = async (id: string, caption: string) => {
    if (!canManage || !slug) return;
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
    await load(slug);
  };

  const preview = items.find((i) => i.id === previewId) ?? null;
  const showManageControls = canManage;
  const showFallbackOnly = !canUseSlug && !ensureArticle && canManage;
  const busy = uploading || recorder.state === "uploading" || recorder.state === "recording";

  return (
    <div className={styles.attachmentsPanel}>
      <h3 className={styles.editorSectionTitle}>{t("attachments.title")}</h3>
      <p className={styles.meta}>{t("attachments.hint")}</p>

      {showFallbackOnly ? (
        <p className={styles.meta}>{t("attachments.saveAfterFirst")}</p>
      ) : null}

      {showManageControls && !showFallbackOnly ? (
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
            if (recorder.state === "recording") return;
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept={KB_PDF_ACCEPT}
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept={KB_IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept={KB_VIDEO_ACCEPT}
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept={KB_AUDIO_ACCEPT}
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={anyInputRef}
            type="file"
            accept={KB_ATTACHMENT_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className={styles.fileActionRow}>
            <button
              type="button"
              className={styles.fileActionBtn}
              disabled={busy}
              onClick={() => pdfInputRef.current?.click()}
            >
              {uploading ? t("attachments.uploading") : t("attachments.addPdf")}
            </button>
            <button
              type="button"
              className={styles.fileActionBtn}
              disabled={busy}
              onClick={() => imageInputRef.current?.click()}
            >
              {uploading ? t("attachments.uploading") : t("attachments.addImage")}
            </button>
            <button
              type="button"
              className={styles.fileActionBtn}
              disabled={busy}
              onClick={() => videoInputRef.current?.click()}
            >
              {uploading ? t("attachments.uploading") : t("attachments.addVideo")}
            </button>
            <button
              type="button"
              className={styles.fileActionBtn}
              disabled={busy}
              onClick={() => audioInputRef.current?.click()}
            >
              {uploading ? t("attachments.uploading") : t("attachments.addAudio")}
            </button>
          </div>

          <div className={styles.recordRow}>
            {recorder.state === "recording" ? (
              <>
                <span className={styles.meta}>
                  {t("attachments.recorder.recording", {
                    duration: formatKbRecordDuration(recorder.elapsedMs),
                  })}
                </span>
                <button
                  type="button"
                  className={styles.fileActionBtn}
                  onClick={() => void saveRecording()}
                >
                  {t("attachments.recorder.stopSave")}
                </button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => recorder.cancelRecording()}
                >
                  {t("attachments.recorder.cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.fileActionBtn}
                disabled={busy}
                onClick={() => {
                  setError(null);
                  recorder.clearError();
                  void recorder.startRecording();
                }}
              >
                {recorder.state === "uploading"
                  ? t("attachments.uploading")
                  : t("attachments.recorder.start")}
              </button>
            )}
          </div>
          <p className={styles.meta}>{t("attachments.dropHint")}</p>
          <p className={styles.meta}>{t("attachments.limitsHint")}</p>
        </div>
      ) : null}

      {error ? <p className={styles.editorError}>{error}</p> : null}
      {recorder.error ? <p className={styles.editorError}>{recorder.error}</p> : null}
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
          ) : preview.kind === "video" ? (
            <video
              controls
              playsInline
              src={`${preview.url}?disposition=inline`}
              className={styles.attachmentVideo}
            />
          ) : preview.kind === "audio" ? (
            <audio
              controls
              src={`${preview.url}?disposition=inline`}
              className={styles.attachmentAudio}
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
