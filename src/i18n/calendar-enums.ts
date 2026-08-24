import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };
import type { CalendarFormValidationCode } from "@/lib/calendar/form";

type MessageTree = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function getNested(tree: MessageTree, keyPath: string): string | undefined {
  const parts = keyPath.split(".");
  let current: unknown = tree;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

function translate(locale: AppLocale, keyPath: string): string {
  const catalog =
    locale === "ru" ? deepMerge(enCatalog, ruCatalog) : enCatalog;
  return getNested(catalog as MessageTree, keyPath) ?? keyPath;
}

export type CalendarScopeKey = "personal" | "company";
export type CalendarEventTypeKey = "general" | "video_meeting";
export type VideoInviteModeKey = "all_team" | "selected";
export type MeetingStatusKey = "waiting" | "open" | "closed";

export function translateCalendarScope(
  locale: AppLocale,
  scope: CalendarScopeKey,
): string {
  return translate(locale, `calendar.enums.scope.${scope}`);
}

export function translateCalendarEventType(
  locale: AppLocale,
  eventType: CalendarEventTypeKey,
): string {
  return translate(locale, `calendar.enums.eventType.${eventType}`);
}

export function translateVideoInviteMode(
  locale: AppLocale,
  mode: VideoInviteModeKey,
): string {
  return translate(locale, `calendar.enums.inviteMode.${mode}`);
}

export function translateMeetingStatus(
  locale: AppLocale,
  status: MeetingStatusKey,
): string {
  return translate(locale, `calendar.enums.meetingStatus.${status}`);
}

export function translateAllDayLabel(locale: AppLocale): string {
  return translate(locale, "calendar.agenda.allDay");
}

export function translateFormValidation(
  locale: AppLocale,
  code: CalendarFormValidationCode,
): string {
  return translate(locale, `calendar.validation.${code}`);
}

export function translateReminderOffset(
  locale: AppLocale,
  offsetMinutes: 1440 | 60 | 10,
): string {
  const key =
    offsetMinutes === 1440
      ? "dayBefore"
      : offsetMinutes === 60
        ? "hourBefore"
        : "tenMinutesBefore";
  return translate(locale, `calendar.reminders.${key}`);
}

export function translateCalendarMessage(
  locale: AppLocale,
  keyPath: string,
  values?: Record<string, string | number>,
): string {
  let message = translate(locale, keyPath);
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      message = message.replaceAll(`{${key}}`, String(value));
    }
  }
  return message;
}
