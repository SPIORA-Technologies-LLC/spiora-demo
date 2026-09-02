"use client";

import {
  clearGuestMeetingDockActive,
  closeGuestMeetingDockWindow,
  focusGuestMeetingDockWindow,
} from "@/lib/calendar/meeting-dock";
import styles from "./MeetingDockGate.module.css";

type GuestMeetingDockGateProps = {
  inviteToken: string;
  eventTitle: string;
  onConnectHere: () => void;
};

export function GuestMeetingDockGate({
  inviteToken,
  eventTitle,
  onConnectHere,
}: GuestMeetingDockGateProps) {
  function handleOpenDock() {
    focusGuestMeetingDockWindow(inviteToken);
  }

  function handleConnectHere() {
    closeGuestMeetingDockWindow(inviteToken);
    clearGuestMeetingDockActive();
    onConnectHere();
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Встреча уже открыта</h1>
      <p className={styles.text}>
        «{eventTitle}» идёт в отдельном окне. Откройте его или подключитесь здесь —
        тогда окно встречи закроется.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={handleOpenDock}>
          Открыть окно встречи
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={handleConnectHere}
        >
          Подключиться здесь
        </button>
      </div>
    </div>
  );
}
