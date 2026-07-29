import "server-only";

import { isClientStatus } from "@/i18n/statuses";
import { parseFlexibleDate } from "@/lib/analytics/dates";
import { listAllClients } from "@/lib/clients/store";
import {
  AI_REQUEST_STATS_DAYS,
  countAiUserMessagesLastDaysForDashboard,
} from "./ai-request-stats";

export type DashboardStats = {
  clientsTotal: number;
  activeConsultations: number;
  aiRequestsThisMonth: number;
  sources: {
    clients: "postgresql" | "google_sheets" | "demo";
    ai: "workspace_chats" | "unavailable";
  };
};

function startOfWeekMonday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const weekday = d.getDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function isOnOrAfter(date: Date, boundary: Date): boolean {
  return date >= boundary;
}

function countConsultationsThisWeek(
  clients: Awaited<ReturnType<typeof listAllClients>>["items"],
): number {
  const weekStart = startOfWeekMonday();

  return clients.filter((client) => {
    if (isClientStatus(client.status, "consultation")) return true;

    const activity =
      parseFlexibleDate(client.lastActivity) ??
      parseFlexibleDate(client.createdAt) ??
      parseFlexibleDate(client.submittedAt);

    if (!activity || !isOnOrAfter(activity, weekStart)) return false;

    return (
      isClientStatus(client.status, "new") ||
      isClientStatus(client.status, "consultation") ||
      /консультац/i.test(client.notes ?? "")
    );
  }).length;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [{ items: clients, source: clientsSource }, aiCount] =
    await Promise.all([
      listAllClients(),
      countAiUserMessagesLastDaysForDashboard(AI_REQUEST_STATS_DAYS),
    ]);

  return {
    clientsTotal: clients.length,
    activeConsultations: countConsultationsThisWeek(clients),
    aiRequestsThisMonth: aiCount,
    sources: {
      clients: clientsSource,
      ai: "workspace_chats",
    },
  };
}
