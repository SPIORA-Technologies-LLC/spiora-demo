"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarMeetingRecordingWithEvent } from "@/lib/calendar/types";
import styles from "./MeetingRecordingsView.module.css";

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "—";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return "—";
  }

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} МБ`;
}

function formatSavedAt(recording: CalendarMeetingRecordingWithEvent): string {
  const raw = recording.endedAt || recording.startedAt;
  return new Date(raw).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingRecordingsView() {
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
        setError(payload.error ?? "Не удалось загрузить записи");
        setRecordings([]);
        return;
      }

      setRecordings(payload.recordings ?? []);
    } catch {
      setError("Не удалось загрузить записи");
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
        setError(payload.error ?? "Не удалось открыть запись");
        setActiveRecordingId(null);
        return;
      }

      setPlaybackUrl(payload.playbackUrl);
      setError(null);
    } catch {
      setError("Не удалось открыть запись");
      setActiveRecordingId(null);
    }
  }

  async function handleDelete(recordingId: string) {
    if (!window.confirm("Удалить эту запись встречи? Файл будет удалён безвозвратно.")) {
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
        setError(payload?.error ?? "Не удалось удалить запись");
        return;
      }

      if (activeRecordingId === recordingId) {
        closePlayer();
      }
      setRecordings((prev) => prev.filter((item) => item.id !== recordingId));
    } catch {
      setError("Не удалось удалить запись");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Записи встреч</h1>
          <p className={styles.subtitle}>
            Видеозаписи сохраняются автоматически, когда запись была включена и
            все участники покинули встречу. Гости не могут записывать и не видят
            этот раздел.
          </p>
        </div>
      </header>

      {loading ? (
        <p className={styles.status}>Загрузка…</p>
      ) : error && recordings.length === 0 ? (
        <p className={styles.error}>{error}</p>
      ) : recordings.length === 0 ? (
        <p className={styles.empty}>
          Пока нет сохранённых записей. Во время видеовстречи нажмите «Запись»,
          затем завершите звонок — файл появится здесь с датой сохранения.
        </p>
      ) : (
        <>
          {error ? <p className={styles.inlineError}>{error}</p> : null}
          <ul className={styles.list}>
            {recordings.map((recording) => (
              <li key={recording.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <h2 className={styles.itemTitle}>{recording.eventTitle}</h2>
                  <p className={styles.itemMeta}>
                    Сохранено: {formatSavedAt(recording)}
                    {" · "}
                    {recording.startedByName}
                    {" · "}
                    {formatDuration(recording.durationSeconds)}
                    {" · "}
                    {formatFileSize(recording.fileSizeBytes)}
                  </p>
                  {recording.linkedClientName ? (
                    <p className={styles.clientMeta}>
                      Клиент: {recording.linkedClientName}
                    </p>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={() => void handlePlay(recording.id)}
                  >
                    Смотреть
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={deletingId === recording.id}
                    onClick={() => void handleDelete(recording.id)}
                  >
                    {deletingId === recording.id ? "…" : "Удалить"}
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
              ? `Просмотр: ${activeRecording.eventTitle}`
              : "Просмотр записи"
          }
        >
          <button
            type="button"
            className={styles.playerBackdrop}
            aria-label="Закрыть просмотр"
            onClick={closePlayer}
          />
          <div className={styles.playerModal}>
            <div className={styles.playerHeader}>
              <h2 className={styles.playerTitle}>
                {activeRecording?.eventTitle ?? "Запись встречи"}
              </h2>
              <button
                type="button"
                className={styles.playerClose}
                onClick={closePlayer}
                aria-label="Закрыть"
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
              <div className={styles.playerLoading}>Загрузка видео…</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
