import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE_NAME = "SPIORA_LOCALE";
export const locales = ["en", "ru"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "never",
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "ru";
}

export function parseLocale(value: string | null | undefined): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}

export function getHtmlLang(locale: AppLocale): AppLocale {
  return parseLocale(locale);
}

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function buildLocaleCookieValue(locale: AppLocale): string {
  return parseLocale(locale);
}

export function buildPreserveRouteUrl(
  pathname: string,
  searchParams: string | URLSearchParams | null | undefined,
): string {
  const query =
    typeof searchParams === "string"
      ? searchParams
      : searchParams?.toString() ?? "";
  return query ? `${pathname}?${query}` : pathname;
}
