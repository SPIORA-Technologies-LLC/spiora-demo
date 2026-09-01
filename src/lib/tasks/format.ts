import type { AppLocale } from "@/i18n/config";
import { formatAppDate } from "@/i18n/format";
import { formatQuestionnaireDate } from "@/lib/client-portal/questionnaire-date";

export function formatTaskDate(iso: string | null, locale: AppLocale): string {
  if (!iso) return "—";
  const datePart = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return iso;
  return formatQuestionnaireDate(datePart, locale);
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
