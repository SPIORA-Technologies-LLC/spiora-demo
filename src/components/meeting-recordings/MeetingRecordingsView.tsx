"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import type { CalendarMeetingRecordingWithEvent } from "@/lib/calendar/types";
import styles from "./MeetingRecordingsView.module.css";

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatSavedAt(recording: CalendarMeetingRecordingWithEvent, locale: AppLocale): string {
  const raw = recording.endedAt || recording.startedAt;
  return new Date(raw).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingRecordingsView() {
  const t = useTranslations("meetingRecordings");
  const locale = useLocale() as AppLocale;
  const [recordings, setRecordings] = useState<
    CalendarMeetingRecordingWithEvent[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatFileSize = useCallback(
    (bytes: number | null): string | null => {
      if (!bytes || bytes <= 0) {
        return null;
      }
      const mb = bytes / (1024 * 1024);
      return t("fileSizeMb", { size: mb.toFixed(1) });
    },
    [t],
  );

  const buildRecordingMeta = useCallback(
    (recording: CalendarMeetingRecordingWithEvent): string => {
      return [
        t("savedAt", { date: formatSavedAt(recording, locale) }),
        recording.startedByName?.trim() || null,
        formatDuration(recording.durationSeconds),
        formatFileSize(recording.fileSizeBytes),
      ]
        .filter(Boolean)
        .join(" · ");
    },
    [formatFileSize, locale, t],
  );

  const activeRecording = recordings.find(
    (recording) => recording.id === activeRecordingId,
  );
  const playerOpen = Boolean(activeRecordingId);

  const closePlayer = useCallback(() => {
    setActiveRecordingId(null);
    setPlaybackUrl(null);
  }, []);

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/meeting-recordings");
      const payload = (await response.json()) as {
        recordings?: CalendarMeetingRecordingWithEvent[];
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? t("loadFailed"));
        setRecordings([]);
        return;
      }

      setRecordings(payload.recordings ?? []);
    } catch {
      setError(t("loadFailed"));
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    if (!playerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePlayer();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePlayer, playerOpen]);

  async function handlePlay(recordingId: string) {
    setActiveRecordingId(recordingId);
    setPlaybackUrl(null);

    try {
      const response = await fetch(
        `/api/meeting-recordings/${encodeURIComponent(recordingId)}/playback`,
      );
      const payload = (await response.json()) as {
        playbackUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.playbackUrl) {
        setError(payload.error ?? t("openFailed"));
        setActiveRecordingId(null);
        return;
      }

      setPlaybackUrl(payload.playbackUrl);
      setError(null);
    } catch {
      setError(t("openFailed"));
      setActiveRecordingId(null);
    }
  }

  async function handleDelete(recordingId: string) {
    if (!window.confirm(t("deleteConfirm"))) {
      return;
    }

    setDeletingId(recordingId);
    setError(null);
    try {
      const response = await fetch(
        `/api/meeting-recordings/${encodeURIComponent(recordingId)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? t("deleteFailed"));
        return;
      }

      if (activeRecordingId === recordingId) {
        closePlayer();
      }
      setRecordings((prev) => prev.filter((item) => item.id !== recordingId));
    } catch {
      setError(t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
      </header>

      {loading ? (
        <p className={styles.status}>{t("loading")}</p>
      ) : error && recordings.length === 0 ? (
        <p className={styles.error}>{error}</p>
      ) : recordings.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <>
          {error ? <p className={styles.inlineError}>{error}</p> : null}
          <ul className={styles.list}>
            {recordings.map((recording) => (
              <li key={recording.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <h2 className={styles.itemTitle}>{recording.eventTitle}</h2>
                  <p className={styles.itemMeta}>
                    {buildRecordingMeta(recording)}
                  </p>
                  {recording.linkedClientName ? (
                    <p className={styles.clientMeta}>
                      {t("client", { name: recording.linkedClientName })}
                    </p>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={() => void handlePlay(recording.id)}
                  >
                    {t("watch")}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={deletingId === recording.id}
                    onClick={() => void handleDelete(recording.id)}
                  >
                    {deletingId === recording.id ? "…" : t("delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {playerOpen ? (
        <div
          className={styles.playerOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={
            activeRecording
              ? t("playerView", { title: activeRecording.eventTitle })
              : t("playerViewDefault")
          }
        >
          <button
            type="button"
            className={styles.playerBackdrop}
            aria-label={t("closeView")}
            onClick={closePlayer}
          />
          <div className={styles.playerModal}>
            <div className={styles.playerHeader}>
              <h2 className={styles.playerTitle}>
                {activeRecording?.eventTitle ?? t("playerViewDefault")}
              </h2>
              <button
                type="button"
                className={styles.playerClose}
                onClick={closePlayer}
                aria-label={t("close")}
              >
                ×
              </button>
            </div>
            {playbackUrl ? (
              <video
                className={styles.player}
                src={playbackUrl}
                controls
                playsInline
                autoPlay
              />
            ) : (
              <div className={styles.playerLoading}>{t("playerLoading")}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
