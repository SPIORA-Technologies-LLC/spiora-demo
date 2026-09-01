import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { CALENDAR_COMPANY_ID } from "@/lib/calendar/constants";
import { listClientInvitations } from "@/lib/client-portal/invitations";
import { listIntakeCases } from "@/lib/client-portal/case-service";
import { listAllClients } from "@/lib/clients/store";
import { countAiUserMessagesForDashboardDay } from "@/lib/dashboard/ai-request-stats";
import {
  isSameMoscowDay,
  moscowDayEndIso,
  moscowDayStartIso,
} from "@/lib/dashboard/activity-day";
import { collectPlatformActivityEvents } from "@/lib/dashboard/platform-activity-feed";
import {
  clampActivityAnchor,
  getActivityDayKey,
  isValidActivityDayKey,
} from "@/lib/presence/daily-activity-logic";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isTaskOverdue, isTaskOverdueOnDay } from "@/lib/tasks/overdue";
import { listTasksForUser } from "@/lib/tasks/store";

export type BriefingTone = "good" | "attention" | "critical";

export type BriefingLine = {
  key: string;
  values?: Record<string, string | number>;
  accent?: boolean;
};

export type BriefingCard = {
  id: string;
  tone: BriefingTone;
  key: string;
  values?: Record<string, string | number>;
  href?: string;
};

export type BriefingActivityItem = {
  id: string;
  type: string;
  at: string;
  actor: string | null;
  key: string;
  values?: Record<string, string | number>;
  href?: string;
};

export type DailyBriefingMetrics = {
  eventsToday: number;
  eventsThisWeek: number;
  tasksOverdue: number;
  tasksPendingApproval: number;
  tasksCompletedToday: number;
  tasksCreatedToday: number;
  clientsTotal: number;
  clientsNewToday: number;
  invitationsPending: number;
  invitationsAcceptedToday: number;
  intakeCasesTotal: number;
  intakeSubmittedToday: number;
  chatMessagesToday: number;
  aiMessagesToday: number;
  documentsTotal: number;
  documentsUploadedToday: number;
};

export type CommandCenterDailyBriefing = {
  dayKey: string;
  metrics: DailyBriefingMetrics;
  summary: BriefingLine[];
  priorities: BriefingCard[];
  insights: BriefingCard[];
  activity: BriefingActivityItem[];
  hasActivityToday: boolean;
};

export type CommandCenterDailyBriefingOptions = {
  /** Moscow calendar day (YYYY-MM-DD). Defaults to today; clamped to retention window. */
  dayKey?: string;
};

/** Parse optional `date` query value; returns null when invalid. */
export function parseCommandCenterDayKey(
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === "") return null;
  const trimmed = value.trim();
  return isValidActivityDayKey(trimmed) ? trimmed : null;
}

export function resolveCommandCenterDayKey(
  value: string | null | undefined,
  now = new Date(),
): string {
  const parsed = parseCommandCenterDayKey(value);
  return clampActivityAnchor(parsed ?? getActivityDayKey(now), now);
}

const BRIEFING_ACTIVITY_PREVIEW = 8;

async function countCalendarEventsBetween(
  fromIso: string,
  toIso: string,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const { sbListEventsInRange } = await import(
      "@/lib/supabase/calendar-events-repo"
    );
    const events = await sbListEventsInRange(CALENDAR_COMPANY_ID, fromIso, toIso);
    return events.length;
  } catch {
    return 0;
  }
}

async function countDocuments(dayKey: string): Promise<{
  total: number;
  uploadedToday: number;
}> {
  if (!isSupabaseConfigured()) {
    return { total: 0, uploadedToday: 0 };
  }
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const client = getSupabaseAdmin();
    const from = moscowDayStartIso(dayKey);
    const to = moscowDayEndIso(dayKey);

    const [totalRes, dayRes] = await Promise.all([
      client
        .from("client_documents")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null),
      client
        .from("client_documents")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .gte("uploaded_at", from)
        .lt("uploaded_at", to),
    ]);

    return {
      total: totalRes.count ?? 0,
      uploadedToday: dayRes.count ?? 0,
    };
  } catch {
    return { total: 0, uploadedToday: 0 };
  }
}

function buildSummary(metrics: DailyBriefingMetrics): BriefingLine[] {
  const lines: BriefingLine[] = [];
  const hasAny =
    metrics.eventsToday > 0 ||
    metrics.tasksCompletedToday > 0 ||
    metrics.tasksOverdue > 0 ||
    metrics.intakeSubmittedToday > 0 ||
    metrics.invitationsAcceptedToday > 0 ||
    metrics.chatMessagesToday > 0 ||
    metrics.clientsNewToday > 0 ||
    metrics.documentsUploadedToday > 0;

  if (!hasAny && metrics.clientsTotal === 0 && metrics.intakeCasesTotal === 0) {
    lines.push({ key: "daily.summary.empty" });
    return lines;
  }

  lines.push({
    key: "daily.summary.eventsToday",
    values: { count: metrics.eventsToday },
  });

  if (metrics.tasksCompletedToday > 0 || metrics.tasksOverdue > 0) {
    lines.push({
      key: "daily.summary.tasksProgress",
      values: {
        completed: metrics.tasksCompletedToday,
        overdue: metrics.tasksOverdue,
      },
    });
  } else {
    lines.push({ key: "daily.summary.tasksAllClear" });
  }

  if (
    metrics.intakeSubmittedToday > 0 ||
    metrics.invitationsAcceptedToday > 0 ||
    metrics.clientsNewToday > 0
  ) {
    lines.push({
      key: "daily.summary.portalActivity",
      values: {
        submitted: metrics.intakeSubmittedToday,
        invites: metrics.invitationsAcceptedToday,
        clients: metrics.clientsNewToday,
      },
    });
  } else {
    lines.push({ key: "daily.summary.portalQuiet" });
  }

  if (metrics.tasksOverdue > 0) {
    lines.push({
      key: "daily.summary.accentOverdue",
      values: { count: metrics.tasksOverdue },
      accent: true,
    });
  } else if (metrics.tasksPendingApproval > 0) {
    lines.push({
      key: "daily.summary.accentPendingApproval",
      values: { count: metrics.tasksPendingApproval },
      accent: true,
    });
  } else {
    lines.push({ key: "daily.summary.accentAllClear", accent: true });
  }

  return lines;
}

function buildPriorities(metrics: DailyBriefingMetrics): BriefingCard[] {
  return [
    {
      id: "meetings",
      tone: metrics.eventsToday > 0 ? "good" : "attention",
      key: "daily.priorities.meetingsToday",
      values: { count: metrics.eventsToday, week: metrics.eventsThisWeek },
      href: "/calendar",
    },
    {
      id: "overdue",
      tone: metrics.tasksOverdue > 0 ? "critical" : "good",
      key: "daily.priorities.overdueTasks",
      values: { count: metrics.tasksOverdue },
      href: "/tasks",
    },
    {
      id: "approval",
      tone: metrics.tasksPendingApproval > 0 ? "attention" : "good",
      key: "daily.priorities.pendingApproval",
      values: { count: metrics.tasksPendingApproval },
      href: "/tasks",
    },
    {
      id: "portal",
      tone:
        metrics.invitationsPending > 0 || metrics.intakeSubmittedToday > 0
          ? "attention"
          : "good",
      key: "daily.priorities.portal",
      values: {
        pendingInvites: metrics.invitationsPending,
        submitted: metrics.intakeSubmittedToday,
        intakeTotal: metrics.intakeCasesTotal,
      },
      href: "/clients/intake",
    },
  ];
}

function buildInsights(metrics: DailyBriefingMetrics): BriefingCard[] {
  const items: BriefingCard[] = [];

  if (metrics.tasksOverdue > 0) {
    items.push({
      id: "overdue",
      tone: "critical",
      key: "daily.insights.overdueTasks",
      values: { count: metrics.tasksOverdue },
      href: "/tasks",
    });
  }
  if (metrics.tasksPendingApproval > 0) {
    items.push({
      id: "approval",
      tone: "attention",
      key: "daily.insights.pendingApproval",
      values: { count: metrics.tasksPendingApproval },
      href: "/tasks",
    });
  }
  if (metrics.invitationsPending > 0) {
    items.push({
      id: "invites",
      tone: "attention",
      key: "daily.insights.pendingInvites",
      values: { count: metrics.invitationsPending },
      href: "/client-invitations",
    });
  }
  if (metrics.eventsToday > 0) {
    items.push({
      id: "calendar",
      tone: "good",
      key: "daily.insights.meetingsToday",
      values: { count: metrics.eventsToday },
      href: "/calendar",
    });
  }
  if (metrics.clientsNewToday > 0) {
    items.push({
      id: "clients",
      tone: "good",
      key: "daily.insights.newClientsToday",
      values: { count: metrics.clientsNewToday },
      href: "/clients",
    });
  }
  if (metrics.intakeSubmittedToday > 0) {
    items.push({
      id: "intake",
      tone: "good",
      key: "daily.insights.intakeSubmitted",
      values: { count: metrics.intakeSubmittedToday },
      href: "/clients/intake",
    });
  }

  return items.slice(0, 3);
}

export async function getCommandCenterDailyBriefing(
  user: SessionUser,
  options?: CommandCenterDailyBriefingOptions,
): Promise<CommandCenterDailyBriefing> {
  const dayKey = clampActivityAnchor(options?.dayKey ?? getActivityDayKey());
  const todayKey = getActivityDayKey();
  const isToday = dayKey === todayKey;
  const dayStart = moscowDayStartIso(dayKey);
  const dayEnd = moscowDayEndIso(dayKey);
  const weekEnd = new Date(`${dayKey}T12:00:00+03:00`);
  weekEnd.setTime(weekEnd.getTime() + 7 * 86_400_000);

  const [
    clientsResult,
    tasks,
    invitations,
    intakePage,
    eventsToday,
    eventsThisWeek,
    documents,
    aiMessagesToday,
    activityEvents,
  ] = await Promise.all([
    listAllClients(),
    listTasksForUser(user),
    listClientInvitations(),
    listIntakeCases({ page: 1, pageSize: 200 }),
    countCalendarEventsBetween(dayStart, dayEnd),
    countCalendarEventsBetween(dayStart, weekEnd.toISOString()),
    countDocuments(dayKey),
    countAiUserMessagesForDashboardDay(dayKey),
    collectPlatformActivityEvents(user, dayKey),
  ]);

  const clients = clientsResult.items;
  const clientsNewToday = clients.filter((c) =>
    isSameMoscowDay(c.createdAt ?? c.submittedAt, dayKey),
  ).length;

  const tasksOverdue = isToday
    ? tasks.filter((t) => isTaskOverdue(t)).length
    : tasks.filter((t) => isTaskOverdueOnDay(t, dayKey)).length;
  const tasksPendingApproval = isToday
    ? tasks.filter((t) => t.status === "pending_approval").length
    : 0;
  const tasksCompletedToday = tasks.filter((t) =>
    isSameMoscowDay(t.completedAt, dayKey),
  ).length;
  const tasksCreatedToday = tasks.filter((t) =>
    isSameMoscowDay(t.createdAt, dayKey),
  ).length;

  const invitationsPending = isToday
    ? invitations.filter((i) => !i.acceptedAt && !i.revokedAt).length
    : 0;
  const invitationsAcceptedToday = invitations.filter((i) =>
    isSameMoscowDay(i.acceptedAt, dayKey),
  ).length;

  const intakeSubmittedToday = intakePage.items.filter((item) =>
    isSameMoscowDay(item.submittedAt, dayKey),
  );

  const metrics: DailyBriefingMetrics = {
    eventsToday,
    eventsThisWeek,
    tasksOverdue,
    tasksPendingApproval,
    tasksCompletedToday,
    tasksCreatedToday,
    clientsTotal: clients.length,
    clientsNewToday,
    invitationsPending,
    invitationsAcceptedToday,
    intakeCasesTotal: intakePage.total,
    intakeSubmittedToday: intakeSubmittedToday.length,
    chatMessagesToday: activityEvents.filter((event) => event.type === "chat_message")
      .length,
    aiMessagesToday,
    documentsTotal: documents.total,
    documentsUploadedToday: documents.uploadedToday,
  };

  const activity: BriefingActivityItem[] = activityEvents
    .slice(0, BRIEFING_ACTIVITY_PREVIEW)
    .map((event) => ({
      id: event.id,
      type: event.type,
      at: event.at,
      actor: event.actor,
      key: event.key,
      values: event.values,
      href: event.href,
    }));

  const hasActivityToday =
    activity.length > 0 ||
    metrics.tasksCompletedToday > 0 ||
    metrics.chatMessagesToday > 0 ||
    metrics.intakeSubmittedToday > 0 ||
    metrics.invitationsAcceptedToday > 0 ||
    metrics.clientsNewToday > 0 ||
    metrics.documentsUploadedToday > 0;

  return {
    dayKey,
    metrics,
    summary: buildSummary(metrics),
    priorities: buildPriorities(metrics),
    insights: buildInsights(metrics),
    activity,
    hasActivityToday,
  };
}
