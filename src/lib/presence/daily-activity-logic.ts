import { PRESENCE_ONLINE_THRESHOLD_MS } from "@/lib/presence/constants";

export type DailyActivityRecord = {
  date: string;
  firstActiveAt: string;
  lastActiveAt: string;
  onlineMs: number;
};

export type TeamMemberDailyActivity = {
  hasActivity: boolean;
  onlineMs: number;
  startedAt: string | null;
  endedAt: string | null;
};

export type ActivityPeriod = "day" | "week" | "month";

export type ActivityDayStat = {
  date: string;
  onlineMs: number;
  startedAt: string | null;
  endedAt: string | null;
};

export type MemberActivityStats = {
  period: ActivityPeriod;
  onlineMs: number;
  days: ActivityDayStat[];
};

/** Keep about three months of per-day history. */
export const DAILY_ACTIVITY_RETENTION_DAYS = 90;

const PERIOD_DAY_COUNTS: Record<ActivityPeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
};

/** Calendar day key in Europe/Moscow (company default). */
export function getActivityDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Shift a Moscow YYYY-MM-DD key by whole days (MSK has no DST). */
export function shiftActivityDayKey(dayKey: string, deltaDays: number): string {
  const date = new Date(`${dayKey}T12:00:00+03:00`);
  date.setTime(date.getTime() + deltaDays * 86_400_000);
  return getActivityDayKey(date);
}

export function listActivityDayKeys(
  period: ActivityPeriod,
  now = new Date(),
): string[] {
  const today = getActivityDayKey(now);
  const count = PERIOD_DAY_COUNTS[period];
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    keys.push(shiftActivityDayKey(today, -offset));
  }
  return keys;
}

export function applyHeartbeatToDailyActivity(
  existing: DailyActivityRecord | null | undefined,
  nowIso: string,
  options?: {
    dayKey?: string;
    onlineThresholdMs?: number;
  },
): DailyActivityRecord {
  const nowMs = Date.parse(nowIso);
  const dayKey = options?.dayKey ?? getActivityDayKey(new Date(nowMs));
  const threshold =
    options?.onlineThresholdMs ?? PRESENCE_ONLINE_THRESHOLD_MS;

  if (!existing || existing.date !== dayKey) {
    return {
      date: dayKey,
      firstActiveAt: nowIso,
      lastActiveAt: nowIso,
      onlineMs: 0,
    };
  }

  const lastMs = Date.parse(existing.lastActiveAt);
  let onlineMs = existing.onlineMs;
  if (!Number.isNaN(lastMs) && nowMs > lastMs) {
    const gap = nowMs - lastMs;
    if (gap <= threshold) {
      onlineMs += gap;
    }
  }

  return {
    date: dayKey,
    firstActiveAt: existing.firstActiveAt,
    lastActiveAt: nowIso,
    onlineMs,
  };
}

export function toTeamMemberDailyActivity(
  record: DailyActivityRecord | null | undefined,
  dayKey = getActivityDayKey(),
): TeamMemberDailyActivity {
  if (!record || record.date !== dayKey) {
    return {
      hasActivity: false,
      onlineMs: 0,
      startedAt: null,
      endedAt: null,
    };
  }
  return {
    hasActivity: true,
    onlineMs: record.onlineMs,
    startedAt: record.firstActiveAt,
    endedAt: record.lastActiveAt,
  };
}

export function pruneActivityDays(
  byDate: Record<string, DailyActivityRecord>,
  retentionDays = DAILY_ACTIVITY_RETENTION_DAYS,
  now = new Date(),
): Record<string, DailyActivityRecord> {
  const cutoff = shiftActivityDayKey(getActivityDayKey(now), -(retentionDays - 1));
  const next: Record<string, DailyActivityRecord> = {};
  for (const [date, record] of Object.entries(byDate)) {
    if (date >= cutoff) {
      next[date] = record;
    }
  }
  return next;
}

export function buildMemberActivityStats(
  byDate: Record<string, DailyActivityRecord>,
  period: ActivityPeriod,
  now = new Date(),
): MemberActivityStats {
  const keys = listActivityDayKeys(period, now);
  const days: ActivityDayStat[] = keys.map((date) => {
    const record = byDate[date];
    if (!record) {
      return {
        date,
        onlineMs: 0,
        startedAt: null,
        endedAt: null,
      };
    }
    return {
      date: record.date,
      onlineMs: record.onlineMs,
      startedAt: record.firstActiveAt,
      endedAt: record.lastActiveAt,
    };
  });

  return {
    period,
    onlineMs: days.reduce((sum, day) => sum + day.onlineMs, 0),
    days,
  };
}

function isDailyRecord(value: unknown): value is DailyActivityRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.date === "string" &&
    typeof row.firstActiveAt === "string" &&
    typeof row.lastActiveAt === "string" &&
    typeof row.onlineMs === "number"
  );
}

export type DailyActivityStoreShape = {
  byUser: Record<string, Record<string, DailyActivityRecord>>;
};

/** Migrate legacy `{ byUser: { id: DailyActivityRecord } }` to per-day maps. */
export function normalizeDailyActivityStore(
  raw: unknown,
): DailyActivityStoreShape {
  if (!raw || typeof raw !== "object") return { byUser: {} };
  const byUserRaw = (raw as { byUser?: unknown }).byUser;
  if (!byUserRaw || typeof byUserRaw !== "object") return { byUser: {} };

  const byUser: Record<string, Record<string, DailyActivityRecord>> = {};
  for (const [userId, entry] of Object.entries(
    byUserRaw as Record<string, unknown>,
  )) {
    if (isDailyRecord(entry)) {
      byUser[userId] = { [entry.date]: entry };
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const dayMap: Record<string, DailyActivityRecord> = {};
    for (const [date, record] of Object.entries(
      entry as Record<string, unknown>,
    )) {
      if (isDailyRecord(record)) {
        dayMap[date] = record;
      }
    }
    byUser[userId] = dayMap;
  }
  return { byUser };
}
