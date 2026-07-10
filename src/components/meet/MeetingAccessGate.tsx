"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { CALENDAR_TIMEZONE } from "@/lib/calendar/constants";
import { resolveCalendarEventTitle } from "@/lib/calendar/demo-event-title";
import { formatEventTimeRange } from "@/lib/calendar/format";
import { formatMeetingOpensAtLabel } from "@/lib/calendar/meeting-client";
import type { CalendarEvent } from "@/lib/calendar/types";
import styles from "./MeetingAccessGate.module.css";

export type MeetingAccessGateVariant =
  | "waiting"
  | "closed"
  | "not_found"
  | "not_video"
  | "forbidden"
  | "not_configured"
  | "connect_error";

type MeetingAccessGateProps = {
  variant: MeetingAccessGateVariant;
  event?: CalendarEvent;
  eventId?: string;
  message?: string;
};

export function MeetingAccessGate({
  variant,
  event,
  message,
}: MeetingAccessGateProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.meet.accessGate");

  const eventHref = event
    ? `/calendar?event=${encodeURIComponent(event.id)}`
    : "/calendar";

  const copy = (() => {
    switch (variant) {
      case "waiting":
        return {
          title: t("waitingTitle"),
          body: event
            ? t("waitingBodyAt", {
                time: formatMeetingOpensAtLabel(event, CALENDAR_TIMEZONE, locale),
              })
            : t("waitingBody"),
          actionLabel: t("backToEvent"),
          actionHref: eventHref,
        };
      case "closed":
        return {
          title: t("closedTitle"),
          body: t("closedBody"),
          actionLabel: t("openInCalendar"),
          actionHref: eventHref,
        };
      case "not_found":
        return {
          title: t("notFoundTitle"),
          body: t("notFoundBody"),
          actionLabel: t("goToCalendar"),
          actionHref: "/calendar",
        };
      case "not_video":
        return {
          title: t("notVideoTitle"),
          body: t("notVideoBody"),
          actionLabel: t("openEvent"),
          actionHref: eventHref,
        };
      case "forbidden":
        return {
          title: t("forbiddenTitle"),
          body: t("forbiddenBody"),
          actionLabel: t("goToCalendar"),
          actionHref: "/calendar",
        };
      case "not_configured":
        return {
          title: t("notConfiguredTitle"),
          body: t("notConfiguredBody"),
          actionLabel: t("goToCalendar"),
          actionHref: eventHref,
        };
      case "connect_error":
        return {
          title: t("connectErrorTitle"),
          body: t("connectErrorBody"),
          actionLabel: t("backToEvent"),
          actionHref: eventHref,
        };
    }
  })();

  const displayTitle = event
    ? resolveCalendarEventTitle(event.title, locale)
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{copy.title}</h1>
        {event && displayTitle ? (
          <p className={styles.eventMeta}>
            {formatEventTimeRange(event, CALENDAR_TIMEZONE, locale)} — {displayTitle}
          </p>
        ) : null}
        <p className={styles.body}>{message ?? copy.body}</p>
        <Link href={copy.actionHref} className={styles.action}>
          {copy.actionLabel}
        </Link>
      </div>
    </div>
  );
}
