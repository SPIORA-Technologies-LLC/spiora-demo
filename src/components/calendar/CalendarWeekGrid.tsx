"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { getWeekdayNames } from "@/i18n/format";
import { formatEventTimeRange } from "@/lib/calendar/format";
import { formatDateKey } from "@/lib/calendar/range";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarTimeZone } from "./CalendarTimeZoneContext";
import {
  WEEK_GRID_END_HOUR,
  WEEK_GRID_START_HOUR,
  WEEK_SLOT_MINUTES,
  buildWeekColumns,
  getAllDayEventsForWeekDay,
  getWeekHourLabels,
  layoutWeekTimedEvents,
  weekGridHasAllDayEvents,
  type WeekTimedLayout,
} from "@/lib/calendar/week";
import styles from "./CalendarWeekGrid.module.css";

type CalendarWeekGridProps = {
  anchorDate: Date;
  events: CalendarEvent[];
  onDayClick: (dateKey: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

const SLOT_COUNT =
  ((WEEK_GRID_END_HOUR - WEEK_GRID_START_HOUR) * 60) / WEEK_SLOT_MINUTES;

function WeekEventBlock({
  layout,
  onEventClick,
}: {
  layout: WeekTimedLayout;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const locale = useLocale() as AppLocale;
  const { timeZone } = useCalendarTimeZone();
  const timeRange = formatEventTimeRange(layout.event, timeZone, locale);
  const isCompact = layout.heightRatio < 0.05;
  const scopeClass =
    layout.event.scope === "personal"
      ? styles.weekEventPersonal
      : styles.weekEventCompany;

  return (
    <button
      type="button"
      className={[
        styles.weekEvent,
        scopeClass,
        isCompact ? styles.weekEventCompact : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        top: `${layout.topRatio * 100}%`,
        height: `${layout.heightRatio * 100}%`,
      }}
      onClick={() => onEventClick?.(layout.event)}
      title={`${layout.event.title} · ${timeRange}`}
      aria-label={`${layout.event.title}, ${timeRange}`}
    >
      {isCompact ? (
        <span className={styles.weekEventTitle}>{layout.event.title}</span>
      ) : (
        <>
          <span className={styles.weekEventTime}>{timeRange}</span>
          <span className={styles.weekEventTitle}>{layout.event.title}</span>
        </>
      )}
    </button>
  );
}

export function CalendarWeekGrid({
  anchorDate,
  events,
  onDayClick,
  onEventClick,
}: CalendarWeekGridProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.weekGrid");
  const { timeZone } = useCalendarTimeZone();
  const weekdayLabels = useMemo(
    () => getWeekdayNames(locale, "short"),
    [locale],
  );
  const todayKey = useMemo(
    () => formatDateKey(new Date(), timeZone),
    [timeZone],
  );
  const columns = useMemo(
    () => buildWeekColumns(anchorDate, todayKey, timeZone),
    [anchorDate, todayKey, timeZone],
  );
  const hourLabels = useMemo(() => getWeekHourLabels(), []);
  const showAllDayRow = useMemo(
    () => weekGridHasAllDayEvents(events, columns, timeZone),
    [columns, events, timeZone],
  );

  const layoutsByDay = useMemo(() => {
    const map = new Map<string, WeekTimedLayout[]>();
    for (const column of columns) {
      map.set(column.dateKey, layoutWeekTimedEvents(events, column.dateKey, timeZone));
    }
    return map;
  }, [columns, events, timeZone]);

  const gridStyle = {
    ["--week-slot-count" as string]: String(SLOT_COUNT),
    ["--week-slot-height" as string]: "2rem",
  };

  return (
    <div className={styles.wrap} style={gridStyle}>
      <div className={styles.header}>
        <div className={styles.timeCorner} aria-hidden />
        {columns.map((column, index) => (
          <button
            key={column.dateKey}
            type="button"
            className={[
              styles.dayHeader,
              column.isToday ? styles.dayHeaderToday : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onDayClick(column.dateKey)}
            aria-label={t("dayAria", { date: column.dateKey })}
          >
            <span className={styles.weekdayLabel}>{weekdayLabels[index]}</span>
            <span className={styles.dayNumber}>{column.dayNumber}</span>
          </button>
        ))}
      </div>

      {showAllDayRow ? (
        <div className={styles.allDayRow}>
          <div className={styles.allDayLabel}>{t("allDay")}</div>
          {columns.map((column) => (
            <div key={column.dateKey} className={styles.allDayCell}>
              {getAllDayEventsForWeekDay(events, column.dateKey, timeZone).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={[
                    styles.weekEvent,
                    event.scope === "personal"
                      ? styles.weekEventPersonal
                      : styles.weekEventCompany,
                  ].join(" ")}
                  style={{ position: "relative", height: "auto" }}
                  onClick={() => onEventClick?.(event)}
                  title={event.title}
                >
                  <span className={styles.weekEventTitle}>{event.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.scrollBody}>
        <div className={styles.grid}>
          <div className={styles.timeColumn} aria-hidden>
            {hourLabels.map((label, index) => (
              <span
                key={label}
                className={styles.timeLabel}
                style={{
                  top: `${(index / (hourLabels.length - 1)) * 100}%`,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {columns.map((column) => (
            <div
              key={column.dateKey}
              className={[
                styles.dayColumn,
                column.isToday ? styles.dayColumnToday : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.slotLines}>
                {Array.from({ length: SLOT_COUNT + 1 }, (_, index) => (
                  <span
                    key={index}
                    className={[
                      styles.slotLine,
                      index % 2 === 0 ? styles.slotLineMajor : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ top: `${(index / SLOT_COUNT) * 100}%` }}
                  />
                ))}
              </div>

              {(layoutsByDay.get(column.dateKey) ?? []).map((layout) => (
                <WeekEventBlock
                  key={layout.event.id}
                  layout={layout}
                  onEventClick={onEventClick}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
