import type { AppLocale } from "@/i18n/config";
import { formatAppDate } from "@/i18n/format";

export function formatTaskDate(iso: string | null, locale: AppLocale): string {
  if (!iso) return "—";
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return formatAppDate(new Date(y, m - 1, d), locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatTaskDateTime(iso: string, locale: AppLocale): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return formatTaskDate(iso, locale);
  return formatAppDate(parsed, locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
