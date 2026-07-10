"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { getIntlLocaleTag } from "@/i18n/format";
import { CALENDAR_SCOPE_COLORS } from "@/lib/calendar/constants";
import { formatScopeLabel } from "@/lib/calendar/format";
import { resolveCalendarEventTitle } from "@/lib/calendar/demo-event-title";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { CalendarViewMode } from "@/lib/calendar/range";
import styles from "./CalendarViewPlaceholder.module.css";

type CalendarViewPlaceholderProps = {
  view: CalendarViewMode;
  events: CalendarEvent[];
};

export function CalendarViewPlaceholder({
  view,
  events,
}: CalendarViewPlaceholderProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar");
  const tToolbar = useTranslations("calendar.toolbar");
  const viewLabel = tToolbar(`views.${view}`);

  const intlTag = getIntlLocaleTag(locale);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t("placeholder.title", { view: viewLabel })}</h3>
        <p className={styles.subtitle}>
          {t("placeholder.subtitle", { count: events.length })}
        </p>
      </div>

      <ul className={styles.list}>
        {events.map((event) => (
          <li key={event.id} className={styles.item}>
            <span
              className={styles.scopeDot}
              style={{ backgroundColor: CALENDAR_SCOPE_COLORS[event.scope] }}
              aria-hidden
            />
            <div className={styles.itemBody}>
              <span className={styles.itemTitle}>
                {resolveCalendarEventTitle(event.title, locale)}
              </span>
              <span className={styles.itemMeta}>
                {formatScopeLabel(event.scope, locale)} ·{" "}
                {new Date(event.startAt).toLocaleString(intlTag, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
