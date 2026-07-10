import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import { translateCalendarEventType } from "@/i18n/calendar-enums";
import { Card } from "@/components/ui/Card";
import { CALENDAR_TIMEZONE } from "@/lib/calendar/constants";
import { resolveCalendarEventTitle } from "@/lib/calendar/demo-event-title";
import { formatEventTimeRange, formatScopeLabel } from "@/lib/calendar/format";
import { isVideoMeeting } from "@/lib/calendar/meeting";
import { listUpcomingCalendarEvents } from "@/lib/calendar/upcoming-events";
import type { CalendarEvent } from "@/lib/calendar/types";
import styles from "./DashboardUpcomingEvents.module.css";

type DashboardUpcomingEventsProps = {
  userId: string;
};

export async function DashboardUpcomingEvents({
  userId,
}: DashboardUpcomingEventsProps) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("dashboard.upcomingEvents");

  let events: CalendarEvent[] = [];
  let failed = false;

  try {
    events = await listUpcomingCalendarEvents(userId, 5);
  } catch {
    failed = true;
    events = [];
  }

  return (
    <section className={styles.section} aria-labelledby="upcoming-events-heading">
      <div className={styles.headingRow}>
        <h2 id="upcoming-events-heading" className={styles.title}>
          {t("title")}
        </h2>
        <Link href="/calendar" className={styles.link}>
          {t("viewCalendar")}
          <i className="fa-solid fa-arrow-right" aria-hidden />
        </Link>
      </div>

      {failed ? (
        <p className={styles.state}>{t("error")}</p>
      ) : events.length === 0 ? (
        <p className={styles.state}>{t("empty")}</p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => {
            const displayTitle = resolveCalendarEventTitle(event.title, locale);
            const video = isVideoMeeting(event);

            return (
              <li key={event.id}>
                <Link
                  href={`/calendar?event=${encodeURIComponent(event.id)}`}
                  className={styles.itemLink}
                >
                  <Card className={styles.itemCard}>
                    <div className={styles.itemTop}>
                      <span className={styles.time}>
                        {formatEventTimeRange(event, CALENDAR_TIMEZONE, locale)}
                      </span>
                      <div className={styles.badges}>
                        {video ? (
                          <span className={styles.videoBadge}>
                            <i className="fa-solid fa-video" aria-hidden />
                            {t("videoBadge")}
                          </span>
                        ) : null}
                        <span
                          className={[
                            styles.scopeBadge,
                            event.scope === "personal"
                              ? styles.scopePersonal
                              : styles.scopeCompany,
                          ].join(" ")}
                        >
                          {formatScopeLabel(event.scope, locale)}
                        </span>
                      </div>
                    </div>
                    <span className={styles.eventTitle}>{displayTitle}</span>
                    <span className={styles.eventType}>
                      {translateCalendarEventType(locale, event.eventType)}
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
