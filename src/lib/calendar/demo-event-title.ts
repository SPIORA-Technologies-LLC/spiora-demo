import type { AppLocale } from "@/i18n/config";
import { translateCalendarMessage } from "@/i18n/calendar-enums";

export const DEMO_EVENT_TITLE_PREFIX = "demo:";

export function isDemoEventTitle(title: string): boolean {
  return title.startsWith(DEMO_EVENT_TITLE_PREFIX);
}

export function buildDemoEventTitle(titleKey: string): string {
  return `${DEMO_EVENT_TITLE_PREFIX}${titleKey}`;
}

export function resolveCalendarEventTitle(
  title: string,
  locale: AppLocale,
): string {
  if (!isDemoEventTitle(title)) {
    return title;
  }

  const key = title.slice(DEMO_EVENT_TITLE_PREFIX.length);
  const translated = translateCalendarMessage(
    locale,
    `calendar.demoEvents.${key}`,
  );
  if (translated === `calendar.demoEvents.${key}`) {
    return title;
  }
  return translated;
}
