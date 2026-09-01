import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { CALENDAR_COMPANY_ID } from "@/lib/calendar/constants";
import { listAllClients } from "@/lib/clients/store";
import { isCrmPostgresPrimary } from "@/lib/clients/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTaskStats } from "@/lib/tasks/store";
import {
  AI_REQUEST_STATS_DAYS,
  countAiUserMessagesLastDaysForDashboard,
} from "./ai-request-stats";

export type CompanyHealthStatusKey = "excellent" | "stable" | "empty";

export type CompanyHealthMetrics = {
  statusKey: CompanyHealthStatusKey;
  clients: number;
  documents: number;
  meetings: number;
  tasksCompletedPercent: number;
  aiConversations: number;
  eventsToday: number;
  sources: {
    clients: "postgresql" | "google_sheets" | "demo";
    meetings: "postgresql" | "file" | "unavailable";
    tasks: "postgresql" | "file" | "unavailable";
    ai: "postgresql" | "file" | "unavailable";
    documents: "postgresql" | "unavailable";
  };
};

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfTodayUtc(): Date {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function countCalendarEventsToday(): Promise<{
  count: number;
  source: CompanyHealthMetrics["sources"]["meetings"];
}> {
  if (!isSupabaseConfigured()) {
    return { count: 0, source: "unavailable" };
  }

  try {
    const { sbListEventsInRange } = await import(
      "@/lib/supabase/calendar-events-repo"
    );
    const from = startOfTodayUtc().toISOString();
    const to = endOfTodayUtc().toISOString();
    const events = await sbListEventsInRange(CALENDAR_COMPANY_ID, from, to);
    return { count: events.length, source: "postgresql" };
  } catch {
    return { count: 0, source: "unavailable" };
  }
}

function deriveStatusKey(metrics: {
  clients: number;
  meetings: number;
  tasksTotal: number;
}): CompanyHealthStatusKey {
  if (metrics.clients === 0 && metrics.meetings === 0 && metrics.tasksTotal === 0) {
    return "empty";
  }
  if (metrics.clients > 0) {
    return "excellent";
  }
  return "stable";
}

async function countStoredDocuments(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { count, error } = await getSupabaseAdmin()
      .from("client_documents")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getCompanyHealthMetrics(
  user: SessionUser,
): Promise<CompanyHealthMetrics> {
  const [clientsResult, taskStats, aiCount, calendarToday, documents] =
    await Promise.all([
    listAllClients(),
    getTaskStats(user),
    countAiUserMessagesLastDaysForDashboard(AI_REQUEST_STATS_DAYS),
    countCalendarEventsToday(),
    countStoredDocuments(),
  ]);

  const tasksCompletedPercent =
    taskStats.total > 0
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0;

  const meetings = calendarToday.count;
  const clients = clientsResult.items.length;

  const statusKey = deriveStatusKey({
    clients,
    meetings,
    tasksTotal: taskStats.total,
  });

  const tasksSource: CompanyHealthMetrics["sources"]["tasks"] =
    isSupabaseConfigured() ? "postgresql" : taskStats.total > 0 ? "file" : "unavailable";

  const aiSource: CompanyHealthMetrics["sources"]["ai"] =
    isSupabaseConfigured() ? "postgresql" : aiCount > 0 ? "file" : "unavailable";

  return {
    statusKey,
    clients,
    documents: documents,
    meetings,
    tasksCompletedPercent,
    aiConversations: aiCount,
    eventsToday: calendarToday.count,
    sources: {
      clients: isCrmPostgresPrimary() ? "postgresql" : clientsResult.source,
      meetings: calendarToday.source,
      tasks: tasksSource,
      ai: aiSource,
      documents: documents > 0 ? "postgresql" : "unavailable",
    },
  };
}
