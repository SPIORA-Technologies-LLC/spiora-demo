"use client";

import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isMeetingRecordingActiveStatus,
  parseMeetingRecordingRoomMetadata,
  type MeetingRecordingRoomNotice,
} from "@/lib/calendar/meeting-recording-notice";
import styles from "./MeetingRecordingNotice.module.css";

type MeetingRecordingNoticeProps = {
  /** Team meeting: poll calendar recording status as a fallback. */
  eventId?: string;
  /** Guest meeting: poll guest-safe recording status as a fallback. */
  inviteToken?: string;
};

function useRecordingNoticeState({
  eventId,
  inviteToken,
}: MeetingRecordingNoticeProps): MeetingRecordingRoomNotice {
  const room = useRoomContext();
  const [fromMeta, setFromMeta] = useState<MeetingRecordingRoomNotice>(() =>
    parseMeetingRecordingRoomMetadata(room.metadata),
  );
  const [fromPoll, setFromPoll] = useState<MeetingRecordingRoomNotice>({
    recording: false,
  });

  const applyMetadata = useCallback((metadata?: string | null) => {
    setFromMeta(parseMeetingRecordingRoomMetadata(metadata));
  }, []);

  useEffect(() => {
    applyMetadata(room.metadata);

    const onMetadata = (metadata: string) => {
      applyMetadata(metadata);
    };

    room.on(RoomEvent.RoomMetadataChanged, onMetadata);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, onMetadata);
    };
  }, [applyMetadata, room]);

  useEffect(() => {
    if (!eventId && !inviteToken) return;

    let cancelled = false;

    async function poll() {
      try {
        if (eventId) {
          const response = await fetch(
            `/api/calendar/events/${encodeURIComponent(eventId)}/meeting-recording`,
          );
          if (!response.ok || cancelled) return;
          const payload = (await response.json()) as {
            recording?: { status?: string; startedByName?: string } | null;
          };
          const recording = payload.recording;
          if (recording && isMeetingRecordingActiveStatus(recording.status)) {
            setFromPoll({
              recording: true,
              startedByName: recording.startedByName,
            });
          } else {
            setFromPoll({ recording: false });
            setFromMeta({ recording: false });
          }
          return;
        }

        if (inviteToken) {
          const response = await fetch("/api/meet/guest-recording-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteToken }),
          });
          if (!response.ok || cancelled) return;
          const payload = (await response.json()) as {
            recording?: boolean;
            startedByName?: string | null;
          };
          if (payload.recording) {
            setFromPoll({
              recording: true,
              startedByName: payload.startedByName ?? undefined,
            });
          } else {
            setFromPoll({ recording: false });
            setFromMeta({ recording: false });
          }
        }
      } catch {
        // ignore polling errors — metadata remains source of truth
      }
    }

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [eventId, inviteToken]);

  return useMemo(() => {
    const recording = fromMeta.recording || fromPoll.recording;
    return {
      recording,
      startedByName: fromMeta.startedByName || fromPoll.startedByName,
    };
  }, [fromMeta, fromPoll]);
}

export function MeetingRecordingNotice(props: MeetingRecordingNoticeProps) {
  const notice = useRecordingNoticeState(props);

  if (!notice.recording) {
    return null;
  }

  const detail = notice.startedByName
    ? `Идёт запись встречи. Все участники уведомлены. Запись начал(а): ${notice.startedByName}.`
    : "Идёт запись встречи. Все участники уведомлены.";

  return (
    <div
      className={styles.chip}
      role="status"
      aria-live="polite"
      aria-label={detail}
      title={detail}
    >
      <span className={styles.dot} aria-hidden />
      <i className={`fa-solid fa-video ${styles.icon}`} aria-hidden />
      <span className={styles.label}>REC</span>
    </div>
  );
}
