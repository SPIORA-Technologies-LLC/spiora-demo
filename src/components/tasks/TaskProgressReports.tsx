"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import type { SessionUser } from "@/lib/auth/types";
import {
  formatFileSize,
  getTaskAttachmentUrl,
  TASK_ATTACHMENT_ACCEPT,
} from "@/lib/tasks/attachment-formats";
import { formatTaskDateTime } from "@/lib/tasks/format";
import {
  canAddTaskProgressReport,
  canDeleteTaskProgressReport,
} from "@/lib/tasks/permissions";
import type { Task, TaskProgressReport } from "@/lib/tasks/types";
import { FileTypeIcon } from "@/components/ui/UiIcon";
import styles from "./TaskProgressReports.module.css";

type TaskProgressReportsSectionProps = {
  task: Task;
  user: SessionUser;
  onTaskUpdated?: (task: Task) => void;
};

export function TaskProgressReportsSection({
  task,
  user,
  onTaskUpdated,
}: TaskProgressReportsSectionProps) {
  const t = useTranslations("tasks");
  const locale = useLocale() as AppLocale;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canAdd = canAddTaskProgressReport(task, user);

  const reports = [...task.progressReports].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  async function handleSubmit() {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError(t("validation.reportCommentRequired"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("comment", trimmed);
      if (pendingFile) formData.append("file", pendingFile);

      const res = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}/progress-reports`,
        { method: "POST", body: formData },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "report failed");
      }
      const data = (await res.json()) as { task?: Task };
      if (data.task) onTaskUpdated?.(data.task);
      setComment("");
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError(t("errors.reportFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(report: TaskProgressReport) {
    if (!window.confirm(t("confirm.deleteReport"))) return;
    setError("");
    try {
      const res = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}/progress-reports/${encodeURIComponent(report.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("delete failed");
      const data = (await res.json()) as { task?: Task };
      if (data.task) onTaskUpdated?.(data.task);
    } catch {
      setError(t("errors.deleteReportFailed"));
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t("progressReports.title")}</h3>
        {reports.length > 0 ? (
          <span className={styles.count}>{reports.length}</span>
        ) : null}
      </div>

      {canAdd ? (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>{t("progressReports.yourReport")}</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={comment}
              disabled={submitting}
              placeholder={t("progressReports.placeholder")}
              onChange={(e) => {
                setComment(e.target.value);
                if (error) setError("");
              }}
            />
          </label>

          <div className={styles.formActions}>
            <div className={styles.fileRow}>
              <input
                ref={fileInputRef}
                type="file"
                accept={TASK_ATTACHMENT_ACCEPT}
                className={styles.hiddenInput}
                disabled={submitting}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPendingFile(file);
                }}
              />
              <button
                type="button"
                className={styles.uploadBtn}
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
              >
                {pendingFile
                  ? t("progressReports.replaceFile")
                  : `+ ${t("progressReports.attachFile")}`}
              </button>
              {pendingFile ? (
                <span className={styles.pendingFile}>
                  {pendingFile.name} · {formatFileSize(pendingFile.size, locale)}
                  <button
                    type="button"
                    className={styles.clearFileBtn}
                    disabled={submitting}
                    aria-label={t("attachments.removeFile")}
                    onClick={() => {
                      setPendingFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </div>
            <p className={styles.hint}>
              {t("progressReports.optionalFileHint")} {t("attachments.hint")}
            </p>
            <button
              type="button"
              className={styles.submitBtn}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? t("progressReports.submitting") : t("progressReports.submit")}
            </button>
          </div>
        </div>
      ) : null}

      {reports.length === 0 ? (
        <p className={styles.empty}>
          {canAdd ? t("empty.reportsCanAdd") : t("empty.reportsReadOnly")}
        </p>
      ) : (
        <ol className={styles.list}>
          {reports.map((report) => {
            const canDelete = canDeleteTaskProgressReport(task, report, user);
            return (
              <li key={report.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.author}>{report.authorName}</span>
                  <time className={styles.time}>
                    {formatTaskDateTime(report.createdAt, locale)}
                  </time>
                  {canDelete ? (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={t("progressReports.deleteReport")}
                      onClick={() => void handleDelete(report)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p className={styles.comment}>{report.comment}</p>
                {report.attachment ? (
                  <a
                    href={getTaskAttachmentUrl(task.id, report.attachment.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.fileLink}
                    title={t("attachments.openFile")}
                  >
                    <FileTypeIcon
                      contentType={report.attachment.contentType}
                      className={styles.fileIcon}
                    />
                    <span className={styles.fileMeta}>
                      <span className={styles.fileName}>
                        {report.attachment.fileName}
                      </span>
                      <span className={styles.fileSub}>
                        {formatFileSize(report.attachment.size, locale)}
                      </span>
                    </span>
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
