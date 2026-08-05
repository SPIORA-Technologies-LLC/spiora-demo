import type { AppLocale } from "@/i18n/config";
import type { CalendarEvent } from "./types";

/**
 * Legacy export: early join buffer is disabled — meetings open as soon as
 * the invite/link is available (see getMeetingAccessWindow).
 */
export const MEETING_EARLY_MINUTES = 0;
export const MEETING_LATE_MINUTES = 15;

export type MeetingAccessPhase = "waiting" | "open" | "closed";

export function getMeetingAccessWindow(
  event: Pick<CalendarEvent, "startAt" | "endAt">,
): { opensAt: Date; closesAt: Date } {
  const endMs = Date.parse(event.endAt);
  return {
    // Open immediately — no "N minutes before start" gate for staff or guests.
    opensAt: new Date(0),
    closesAt: new Date(endMs + MEETING_LATE_MINUTES * 60_000),
  };
}

export function isWithinMeetingWindow(
  event: Pick<CalendarEvent, "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  const { opensAt, closesAt } = getMeetingAccessWindow(event);
  const t = now.getTime();
  return t >= opensAt.getTime() && t <= closesAt.getTime();
}

export function getMeetingAccessPhase(
  event: Pick<CalendarEvent, "startAt" | "endAt">,
  now: Date = new Date(),
): MeetingAccessPhase {
  const { opensAt, closesAt } = getMeetingAccessWindow(event);
  const t = now.getTime();
  if (t < opensAt.getTime()) {
    return "waiting";
  }
  if (t > closesAt.getTime()) {
    return "closed";
  }
  return "open";
}

export function formatMeetingOpensAtLabel(
  event: Pick<CalendarEvent, "startAt" | "endAt">,
  timeZone: string,
  locale: AppLocale = "ru",
): string {
  const { opensAt } = getMeetingAccessWindow(event);
  const dateLocale = locale === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(opensAt);
}
