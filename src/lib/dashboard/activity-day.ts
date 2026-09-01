import { parseFlexibleDate } from "@/lib/analytics/dates";
import { getActivityDayKey } from "@/lib/presence/daily-activity-logic";

export function isSameMoscowDay(
  iso: string | null | undefined,
  dayKey: string,
): boolean {
  if (!iso) return false;
  const parsed =
    parseFlexibleDate(iso) ?? (Date.parse(iso) ? new Date(iso) : null);
  if (!parsed || Number.isNaN(parsed.getTime())) return false;
  return getActivityDayKey(parsed) === dayKey;
}

export function moscowDayStartIso(dayKey: string): string {
  return `${dayKey}T00:00:00+03:00`;
}

export function moscowDayEndIso(dayKey: string): string {
  const start = new Date(`${dayKey}T12:00:00+03:00`);
  start.setTime(start.getTime() + 86_400_000);
  return start.toISOString();
}
