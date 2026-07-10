"use client";

import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { CALENDAR_SCOPE_COLORS } from "@/lib/calendar/constants";
import { resolveCalendarEventTitle } from "@/lib/calendar/demo-event-title";
import {
  formatEventTimeRange,
  formatScopeLabel,
} from "@/lib/calendar/format";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarTimeZone } from "./CalendarTimeZoneContext";
import styles from "./CalendarEventChip.module.css";

type CalendarEventChipProps = {
  event: CalendarEvent;
  variant?: "agenda" | "month";
  onClick?: (event: CalendarEvent) => void;
};

export function CalendarEventChip({
  event,
  variant = "agenda",
  onClick,
}: CalendarEventChipProps) {
  const locale = useLocale() as AppLocale;
  const { timeZone } = useCalendarTimeZone();
  const scopeClass =
    event.scope === "personal" ? styles.personal : styles.company;
  const timeRange = formatEventTimeRange(event, timeZone, locale);
  const scopeLabel = formatScopeLabel(event.scope, locale);
  const displayTitle = resolveCalendarEventTitle(event.title, locale);

  if (variant === "month") {
    return (
      <button
        type="button"
        className={[styles.monthChip, scopeClass].join(" ")}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          onClick?.(event);
        }}
        aria-label={`${displayTitle}, ${scopeLabel}`}
        title={displayTitle}
      >
        <span className={styles.monthTitle}>{displayTitle}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={[styles.chip, scopeClass].join(" ")}
      onClick={() => onClick?.(event)}
      aria-label={`${displayTitle}, ${scopeLabel}, ${timeRange}`}
    >
      <span className={styles.time}>{timeRange}</span>
      <span className={styles.body}>
        <span className={styles.title}>{displayTitle}</span>
        <span className={styles.scope}>{scopeLabel}</span>
      </span>
      <span
        className={styles.accent}
        style={{ backgroundColor: CALENDAR_SCOPE_COLORS[event.scope] }}
        aria-hidden
      />
    </button>
  );
}
