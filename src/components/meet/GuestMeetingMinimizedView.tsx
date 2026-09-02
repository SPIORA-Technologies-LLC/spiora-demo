"use client";

import { branding } from "@/config/branding";
import { formatEventTimeRange } from "@/lib/calendar/format";
import { CALENDAR_TIMEZONE } from "@/lib/calendar/constants";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  focusGuestMeetingDockWindow,
  readGuestMeetingDockSession,
} from "@/lib/calendar/meeting-dock";
import styles from "./GuestMeetRoom.module.css";

type GuestMeetingMinimizedViewProps = {
  event: CalendarEvent;
  inviteToken: string;
};

export function GuestMeetingMinimizedView({
  event,
  inviteToken,
}: GuestMeetingMinimizedViewProps) {
  const session = readGuestMeetingDockSession();

  return (
    <div className={styles.lobbyPage}>
      <div className={styles.lobbyCard}>
        <p className={styles.lobbyBrand}>{branding.productName}</p>
        <h1 className={styles.lobbyTitle}>Встреча свёрнута</h1>
        <p className={styles.lobbyEventTitle}>{event.title}</p>
        <p className={styles.lobbyEventTime}>
          {formatEventTimeRange(event, CALENDAR_TIMEZONE)}
        </p>
        <p className={styles.waitingHint}>
          Звонок продолжается в отдельном окне. Откройте другие вкладки или сайты —
          вы останетесь на связи. Чтобы вернуться к видеовстрече, нажмите кнопку
          ниже.
        </p>
        <button
          type="button"
          className={styles.joinButton}
          onClick={() => focusGuestMeetingDockWindow(inviteToken)}
        >
          Открыть окно встречи
        </button>
        {session?.inviteToken === inviteToken ? (
          <p className={styles.minimizedStatus}>Статус: в эфире</p>
        ) : null}
      </div>
    </div>
  );
}
