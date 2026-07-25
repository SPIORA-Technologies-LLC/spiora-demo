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

/** Calendar day key in Europe/Moscow (company default). */
export function getActivityDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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
