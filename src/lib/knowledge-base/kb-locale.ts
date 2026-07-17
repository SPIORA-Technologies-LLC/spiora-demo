import type { AppLocale } from "@/i18n/config";
import { parseLocale } from "@/i18n/config";

export type KbTranslationPick = {
  locale: AppLocale;
  title: string;
  summary: string;
  content: string;
};

/**
 * Prefer the requested locale; if missing, fall back to the other locale
 * (never silently prefer an arbitrary join order).
 */
export function pickKbTranslation(
  translations: KbTranslationPick[],
  requestedLocale: AppLocale,
): {
  translation: KbTranslationPick;
  resolvedLocale: AppLocale;
  fallbackUsed: boolean;
} | null {
  if (!translations.length) return null;

  const preferred = translations.find((t) => t.locale === requestedLocale);
  if (preferred) {
    return {
      translation: preferred,
      resolvedLocale: requestedLocale,
      fallbackUsed: false,
    };
  }

  const other: AppLocale = requestedLocale === "en" ? "ru" : "en";
  const fallback =
    translations.find((t) => t.locale === other) ?? translations[0]!;

  return {
    translation: fallback,
    resolvedLocale: fallback.locale,
    fallbackUsed: true,
  };
}

/** Query `locale` wins over cookie so client switches are explicit. */
export function resolveKbRequestLocale(
  queryLocale: string | null | undefined,
  cookieLocale: AppLocale,
): AppLocale {
  if (queryLocale === "en" || queryLocale === "ru") return queryLocale;
  return parseLocale(cookieLocale);
}

/** Build list URL query; always includes locale (cache key + refetch signal). */
export function buildKbListQuery(params: {
  locale: AppLocale;
  q?: string;
  category?: string;
  tag?: string;
  article?: string;
  folderId?: string;
  status?: string;
}): string {
  const search = new URLSearchParams();
  search.set("locale", params.locale);
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.article) search.set("article", params.article);
  if (params.folderId) search.set("folderId", params.folderId);
  if (params.status) search.set("status", params.status);
  return search.toString();
}
