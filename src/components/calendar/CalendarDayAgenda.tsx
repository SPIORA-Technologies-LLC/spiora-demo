"use client";

import { useTranslations } from "next-intl";
import { partitionDayAgenda } from "@/lib/calendar/format";
import type { CalendarEvent } from "@/lib/calendar/types";
import { CalendarEventChip } from "./CalendarEventChip";
import styles from "./CalendarDayAgenda.module.css";

type CalendarDayAgendaProps = {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
};

export function CalendarDayAgenda({ events, onEventClick }: CalendarDayAgendaProps) {
  const t = useTranslations("calendar.agenda");
  const { allDay, timed } = partitionDayAgenda(events);

  return (
    <div className={styles.wrap}>
      {allDay.length > 0 ? (
        <section className={styles.section} aria-label={t("allDayEventsAria")}>
          <h3 className={styles.sectionTitle}>{t("allDay")}</h3>
          <ul className={styles.list}>
            {allDay.map((event) => (
              <li key={event.id}>
                <CalendarEventChip event={event} onClick={onEventClick} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {timed.length > 0 ? (
        <section className={styles.section} aria-label={t("timedEventsAria")}>
          {allDay.length === 0 ? (
            <h3 className={styles.sectionTitle}>{t("daySchedule")}</h3>
          ) : null}
          <ul className={styles.list}>
            {timed.map((event) => (
              <li key={event.id}>
                <CalendarEventChip event={event} onClick={onEventClick} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
