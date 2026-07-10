import type { AppLocale } from "@/i18n/config";
import { getIntlLocaleTag } from "@/i18n/format";
import { translateAllDayLabel, translateCalendarScope } from "@/i18n/calendar-enums";
import { CALENDAR_TIMEZONE } from "./constants";
import { formatDateKey } from "./range";
import type { CalendarEvent, CalendarScope } from "./types";

function createTimeFormatter(
  locale: AppLocale,
  ianaTimeZone: string,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getIntlLocaleTag(locale), {
    timeZone: ianaTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

const dayLabelFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDayLabelFormatter(
  locale: AppLocale,
  ianaTimeZone: string,
): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${ianaTimeZone}`;
  let formatter = dayLabelFormatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(getIntlLocaleTag(locale), {
      timeZone: ianaTimeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    dayLabelFormatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function formatScopeLabel(
  scope: CalendarScope,
  locale: AppLocale = "en",
): string {
  return translateCalendarScope(locale, scope);
}

export function formatEventTimeRange(
  event: CalendarEvent,
  timeZone: string = CALENDAR_TIMEZONE,
  locale: AppLocale = "en",
): string {
  if (event.allDay) {
    return translateAllDayLabel(locale);
  }

  const formatter = createTimeFormatter(locale, timeZone);
  const start = formatter.format(new Date(event.startAt));
  const end = formatter.format(new Date(event.endAt));
  return `${start} – ${end}`;
}

export function formatDayLabel(
  date: Date,
  timeZone: string = CALENDAR_TIMEZONE,
  locale: AppLocale = "en",
): string {
  const label = getDayLabelFormatter(locale, timeZone).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function sortEventsByStartAt(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function eventOccursOnDate(
  event: CalendarEvent,
  dateKey: string,
  timeZone: string = CALENDAR_TIMEZONE,
): boolean {
  const startKey = formatDateKey(new Date(event.startAt), timeZone);
  const endKey = formatDateKey(new Date(event.endAt), timeZone);
  return startKey <= dateKey && endKey >= dateKey;
}

export function eventsForDay(
  events: CalendarEvent[],
  dateKey: string,
  timeZone: string = CALENDAR_TIMEZONE,
): CalendarEvent[] {
  return sortEventsByStartAt(
    events.filter((event) => eventOccursOnDate(event, dateKey, timeZone)),
  );
}

export function partitionDayAgenda(events: CalendarEvent[]): {
  allDay: CalendarEvent[];
  timed: CalendarEvent[];
} {
  const sorted = sortEventsByStartAt(events);

  return {
    allDay: sorted.filter((event) => event.allDay),
    timed: sorted.filter((event) => !event.allDay),
  };
}
