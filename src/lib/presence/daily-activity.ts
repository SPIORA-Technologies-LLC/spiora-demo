import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyHeartbeatToDailyActivity,
  getActivityDayKey,
  toTeamMemberDailyActivity,
  type DailyActivityRecord,
  type TeamMemberDailyActivity,
} from "@/lib/presence/daily-activity-logic";
import { getAppState, setAppState } from "@/lib/supabase/app-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type {
  DailyActivityRecord,
  TeamMemberDailyActivity,
} from "@/lib/presence/daily-activity-logic";
export {
  applyHeartbeatToDailyActivity,
  getActivityDayKey,
  toTeamMemberDailyActivity,
} from "@/lib/presence/daily-activity-logic";

const STORE_PATH = path.join(process.cwd(), ".data", "user-presence-daily.json");
const APP_STATE_KEY = "user_presence_daily";

type DailyActivityStore = {
  byUser: Record<string, DailyActivityRecord>;
};

const EMPTY_STORE: DailyActivityStore = { byUser: {} };

async function readFileStore(): Promise<DailyActivityStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as DailyActivityStore;
    if (!data?.byUser || typeof data.byUser !== "object") {
      return EMPTY_STORE;
    }
    return data;
  } catch {
    return EMPTY_STORE;
  }
}

async function writeFileStore(store: DailyActivityStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function readStore(): Promise<DailyActivityStore> {
  if (isSupabaseConfigured()) {
    try {
      const value = await getAppState<DailyActivityStore>(APP_STATE_KEY);
      return value?.byUser ? value : EMPTY_STORE;
    } catch (error) {
      console.error("[presence/daily] supabase read", error);
      return EMPTY_STORE;
    }
  }
  return readFileStore();
}

async function writeStore(store: DailyActivityStore): Promise<boolean> {
  if (isSupabaseConfigured()) {
    return setAppState(APP_STATE_KEY, store);
  }
  try {
    await writeFileStore(store);
    return true;
  } catch (error) {
    console.error("[presence/daily] file write", error);
    return false;
  }
}

export async function recordDailyPresenceHeartbeat(
  userId: string,
  lastActiveAt = new Date().toISOString(),
): Promise<DailyActivityRecord> {
  const store = await readStore();
  const next = applyHeartbeatToDailyActivity(
    store.byUser[userId],
    lastActiveAt,
  );
  store.byUser[userId] = next;
  await writeStore(store);
  return next;
}

export async function getDailyActivityMap(
  userIds: string[],
): Promise<Record<string, TeamMemberDailyActivity>> {
  const store = await readStore();
  const dayKey = getActivityDayKey();
  const map: Record<string, TeamMemberDailyActivity> = {};
  for (const userId of userIds) {
    map[userId] = toTeamMemberDailyActivity(store.byUser[userId], dayKey);
  }
  return map;
}
