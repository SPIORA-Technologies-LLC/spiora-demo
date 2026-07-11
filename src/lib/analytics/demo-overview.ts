import "server-only";

import type { AppLocale } from "@/i18n/config";
import { translateAnalyticsMessage } from "@/i18n/analytics-messages";
import type { OverviewAnalytics } from "./types";

const DEMO_TEAM_WORKLOAD = [
  { memberId: "olivia-bennett", name: "Olivia Bennett", openTasks: 4, activeClients: 3 },
  { memberId: "daniel-cooper", name: "Daniel Cooper", openTasks: 7, activeClients: 5 },
  { memberId: "emma-wilson", name: "Emma Wilson", openTasks: 6, activeClients: 4 },
  { memberId: "lucas-martin", name: "Lucas Martin", openTasks: 5, activeClients: 4 },
] as const;

function monthLabel(locale: AppLocale, monthIndex: number): string {
  const date = new Date(2026, monthIndex, 1);
  const intlTag = locale === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(intlTag, { month: "short" }).format(date);
}

export function buildDemoOverviewAnalytics(
  locale: AppLocale = "en",
): OverviewAnalytics {
  const now = new Date().toISOString();
  const monthlyActivity = [0, 1, 2, 3, 4, 5].map((offset) => {
    const index = (new Date().getMonth() - 5 + offset + 12) % 12;
    return {
      key: `2026-${String(index + 1).padStart(2, "0")}`,
      label: monthLabel(locale, index),
      newLeads: [3, 4, 2, 5, 4, 3][offset],
      completedCases: [2, 3, 3, 4, 3, 4][offset],
      tasksClosed: [8, 10, 7, 12, 9, 11][offset],
    };
  });

  const clientDistribution = [
    {
      direction: translateAnalyticsMessage(locale, "overview.distribution.spain"),
      count: 5,
      share: 42,
    },
    {
      direction: translateAnalyticsMessage(locale, "overview.distribution.croatia"),
      count: 3,
      share: 25,
    },
    {
      direction: translateAnalyticsMessage(locale, "overview.distribution.portugal"),
      count: 2,
      share: 17,
    },
    {
      direction: translateAnalyticsMessage(locale, "overview.distribution.other"),
      count: 2,
      share: 16,
    },
  ];

  return {
    source: "demo",
    generatedAt: now,
    demo: true,
    kpis: {
      activeClients: 12,
      newLeads: 4,
      completedCases: 18,
      overdueTasks: 3,
      upcomingDeadlines: 6,
      avgProcessingDays: 24,
      taskCompletionRate: 78,
    },
    monthlyActivity,
    teamWorkload: DEMO_TEAM_WORKLOAD.map((row) => ({
      ...row,
      role: row.memberId === "olivia-bennett" ? "owner" : "manager",
    })),
    clientDistribution,
    comparison: {
      activeClientsDelta: 8,
      newLeadsDelta: -12,
      completedCasesDelta: 15,
      overdueTasksDelta: -25,
    },
  };
}

export const DEMO_OVERVIEW_KPI_KEYS = [
  "activeClients",
  "newLeads",
  "completedCases",
  "overdueTasks",
  "upcomingDeadlines",
  "avgProcessingDays",
  "taskCompletionRate",
] as const;
