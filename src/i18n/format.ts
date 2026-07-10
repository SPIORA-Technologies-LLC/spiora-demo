import type { AppLocale } from "./config";

const EN_LOCALE_TAG = "en-US";
const RU_LOCALE_TAG = "ru-RU";

export function getIntlLocaleTag(locale: AppLocale): string {
  return locale === "ru" ? RU_LOCALE_TAG : EN_LOCALE_TAG;
}

export function formatAppDate(
  value: Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(getIntlLocaleTag(locale), options).format(value);
}

export function formatAppTime(
  value: Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatAppDate(value, locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatAppNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(getIntlLocaleTag(locale)).format(value);
}

export function formatAppRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: AppLocale,
): string {
  return new Intl.RelativeTimeFormat(getIntlLocaleTag(locale), {
    numeric: "auto",
  }).format(value, unit);
}

export function getWeekdayNames(locale: AppLocale, style: "long" | "short" = "long") {
  const formatter = new Intl.DateTimeFormat(getIntlLocaleTag(locale), {
    weekday: style,
  });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2024, 0, index + 1)),
  );
}

export function getMonthNames(locale: AppLocale, style: "long" | "short" = "long") {
  const formatter = new Intl.DateTimeFormat(getIntlLocaleTag(locale), {
    month: style,
  });
  return Array.from({ length: 12 }, (_, index) =>
    formatter.format(new Date(2024, index, 1)),
  );
}
