"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { getMeetingRoomName, isVideoMeeting } from "@/lib/calendar/meeting";
import {
  formatMeetingOpensAtLabel,
  getMeetingAccessPhase,
} from "@/lib/calendar/meeting-client";
import type { CalendarEvent } from "@/lib/calendar/types";
import styles from "./MeetingJoinButton.module.css";

type MeetingJoinButtonProps = {
  event: CalendarEvent;
  timeZone: string;
};

export function MeetingJoinButton({ event, timeZone }: MeetingJoinButtonProps) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.meet");

  if (!isVideoMeeting(event)) {
    return null;
  }

  const phase = getMeetingAccessPhase(event);
  const disabled = phase !== "open";

  function handleJoin() {
    if (disabled) {
      return;
    }
    router.push(`/calendar/meet/${encodeURIComponent(event.id)}`);
  }

  let hint: string | null = null;
  if (phase === "waiting") {
    hint = t("opensIn15Min", {
      time: formatMeetingOpensAtLabel(event, timeZone, locale),
    });
  } else if (phase === "closed") {
    hint = t("meetingEnded");
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.joinButton}
        disabled={disabled}
        onClick={handleJoin}
        aria-label={t("joinAria")}
      >
        <i className="fa-solid fa-video" aria-hidden="true" />
        {t("joinLabel")}
      </button>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
