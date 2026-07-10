import { parseLocale, type AppLocale } from "./config";

export function resolveLocaleFromSources(
  requestLocale?: string | null,
  cookieLocale?: string | null,
): AppLocale {
  return parseLocale(cookieLocale ?? requestLocale);
}
