import type { AppLocale } from "@/i18n/config";
import { translateCalendarMessage } from "@/i18n/calendar-enums";
import { formatEventTimeRange } from "@/lib/calendar/format";
import { isVideoMeeting } from "@/lib/calendar/meeting";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { ReminderOffsetMinutes } from "@/lib/calendar/constants";

const EVENT_ID_SEPARATOR = "\u2063";

export function getCalendarReminderTitle(
  offsetMinutes: ReminderOffsetMinutes,
  locale: AppLocale = "en",
): string {
  return translateReminderOffset(locale, offsetMinutes);
}

function translateReminderOffset(
  locale: AppLocale,
  offsetMinutes: ReminderOffsetMinutes,
): string {
  const key = offsetMinutes === 1440 ? "dayBefore" : "hourBefore";
  return translateCalendarMessage(locale, `calendar.reminders.${key}`);
}

export function formatCalendarReminderDisplayMessage(
  event: CalendarEvent,
  locale: AppLocale = "en",
): string {
  const time = formatEventTimeRange(event, undefined, locale);
  return `${time} — ${event.title}`;
}

export function encodeCalendarReminderMessage(
  displayMessage: string,
  eventId: string,
  options?: { isVideoMeeting?: boolean },
): string {
  const flag = options?.isVideoMeeting ? "1" : "0";
  return `${displayMessage}${EVENT_ID_SEPARATOR}${eventId}${EVENT_ID_SEPARATOR}${flag}`;
}

export function decodeCalendarReminderMessage(message: string): {
  display: string;
  eventId: string | null;
  isVideoMeeting: boolean;
} {
  const parts = message.split(EVENT_ID_SEPARATOR);
  if (parts.length === 1) {
    return { display: message, eventId: null, isVideoMeeting: false };
  }

  if (parts.length === 2) {
    return {
      display: parts[0],
      eventId: parts[1] || null,
      isVideoMeeting: false,
    };
  }

  const flag = parts[parts.length - 1];
  const eventId = parts[parts.length - 2];
  const display = parts.slice(0, -2).join(EVENT_ID_SEPARATOR);

  return {
    display,
    eventId: eventId || null,
    isVideoMeeting: flag === "1",
  };
}

export function buildCalendarReminderNotificationContent(
  event: CalendarEvent,
  offsetMinutes: ReminderOffsetMinutes,
  locale: AppLocale = "en",
): { title: string; message: string } {
  const displayMessage = formatCalendarReminderDisplayMessage(event, locale);
  return {
    title: getCalendarReminderTitle(offsetMinutes, locale),
    message: encodeCalendarReminderMessage(displayMessage, event.id, {
      isVideoMeeting: isVideoMeeting(event),
    }),
  };
}

export function buildVideoMeetingInviteNotificationContent(
  event: CalendarEvent,
  locale: AppLocale = "en",
): { title: string; message: string } {
  const displayMessage = formatCalendarReminderDisplayMessage(event, locale);
  return {
    title: translateCalendarMessage(locale, "calendar.notifications.videoInviteTitle"),
    message: encodeCalendarReminderMessage(displayMessage, event.id, {
      isVideoMeeting: true,
    }),
  };
}
