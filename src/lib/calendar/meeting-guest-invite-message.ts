import type { AppLocale } from "@/i18n/config";
import { translateCalendarMessage } from "@/i18n/calendar-enums";
import { branding } from "@/config/branding";
import { resolveCalendarEventTitle } from "./demo-event-title";
import { formatDayLabel, formatEventTimeRange } from "./format";
import { CALENDAR_TIMEZONE } from "./constants";
import type { CalendarEvent } from "./types";

function greetingKeyForMeetingHour(hour: number): string {
  if (hour < 12) {
    return "greetingMorning";
  }
  if (hour < 18) {
    return "greetingAfternoon";
  }
  return "greetingEvening";
}

function meetingStartHour(
  event: CalendarEvent,
  timeZone: string,
  locale: AppLocale,
): number {
  const intlTag = locale === "ru" ? "ru-RU" : "en-US";
  return Number(
    new Intl.DateTimeFormat(intlTag, {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(new Date(event.startAt)),
  );
}

export function buildGuestMeetingInviteText(
  event: CalendarEvent,
  guestJoinUrl: string,
  options?: {
    recipientName?: string | null;
    timeZone?: string;
    locale?: AppLocale;
  },
): string {
  const timeZone = options?.timeZone ?? CALENDAR_TIMEZONE;
  const locale = options?.locale ?? "en";
  const greetingKey = greetingKeyForMeetingHour(
    meetingStartHour(event, timeZone, locale),
  );
  const greeting = translateCalendarMessage(
    locale,
    `calendar.meet.inviteMessage.${greetingKey}`,
  );
  const recipientName = options?.recipientName?.trim();
  const salutation = recipientName
    ? translateCalendarMessage(locale, "calendar.meet.inviteMessage.salutation", {
        greeting,
        name: recipientName,
      })
    : translateCalendarMessage(
        locale,
        "calendar.meet.inviteMessage.salutationNoName",
        { greeting },
      );
  const dateLabel = formatDayLabel(new Date(event.startAt), timeZone, locale);
  const timeRange = formatEventTimeRange(event, timeZone, locale);
  const displayTitle = resolveCalendarEventTitle(event.title, locale);
  const scheduleLine = event.allDay
    ? translateCalendarMessage(locale, "calendar.meet.inviteMessage.allDay", {
        date: dateLabel,
      })
    : translateCalendarMessage(locale, "calendar.meet.inviteMessage.schedule", {
        date: dateLabel,
        time: timeRange,
      });

  return [
    salutation,
    "",
    translateCalendarMessage(locale, "calendar.meet.inviteMessage.body", {
      title: displayTitle,
    }),
    "",
    translateCalendarMessage(locale, "calendar.meet.inviteMessage.when", {
      schedule: scheduleLine,
    }),
    "",
    translateCalendarMessage(locale, "calendar.meet.inviteMessage.joinHint"),
    guestJoinUrl,
    "",
    translateCalendarMessage(locale, "calendar.meet.inviteMessage.closing"),
    translateCalendarMessage(locale, "calendar.meet.inviteMessage.team", {
      company: branding.productName,
    }),
  ].join("\n");
}
