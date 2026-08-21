import type { AppLocale } from "@/i18n/config";
import {
  buildDateKey,
  daysInMonth,
  parseDateKey,
} from "@/lib/calendar/datetime-input";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_OR_DOT_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/;

function normalizeYear(raw: string): number {
  if (raw.length === 2) {
    const n = Number(raw);
    // Birth dates: 00–29 → 2000s, 30–99 → 1900s
    return n <= 29 ? 2000 + n : 1900 + n;
  }
  return Number(raw);
}

function isValidParts(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= 1900 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/**
 * True when the typed value already has a full 4-digit year.
 * Used while typing so "09.09.19" is not expanded to 2019 before "1985" is finished.
 */
export function isCompleteQuestionnaireDateInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (ISO_RE.test(trimmed)) return true;
  const match = SLASH_OR_DOT_RE.exec(trimmed);
  return Boolean(match && match[3].length === 4);
}

/** Display ISO `YYYY-MM-DD` in the UI locale format. */
export function formatQuestionnaireDate(
  iso: string,
  locale: AppLocale,
): string {
  const parts = parseDateKey(iso.trim());
  if (!parts) return iso;
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  if (locale === "ru") {
    return `${dd}.${mm}.${parts.year}`;
  }
  return `${mm}/${dd}/${parts.year}`;
}

/**
 * Parse a typed date into ISO `YYYY-MM-DD`.
 * RU expects day.month.year; EN expects month/day/year.
 * ISO input is always accepted.
 * Two-digit years are expanded only for complete day/month/year triples (use on blur).
 */
export function parseQuestionnaireDate(
  value: string,
  locale: AppLocale,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = ISO_RE.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidParts(year, month, day)) return null;
    return buildDateKey({ year, month, day });
  }

  const match = SLASH_OR_DOT_RE.exec(trimmed);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[2]);
  const year = normalizeYear(match[3]);

  const day = locale === "ru" ? a : b;
  const month = locale === "ru" ? b : a;

  if (!isValidParts(year, month, day)) return null;
  return buildDateKey({ year, month, day });
}
