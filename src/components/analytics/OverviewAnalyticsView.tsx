"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { translateRole } from "@/i18n/roles";
import type { OverviewAnalytics } from "@/lib/analytics/types";
import { AnalyticsBlock } from "./AnalyticsBlock";
import { AnalyticsTable } from "./AnalyticsTable";
import { KpiGrid } from "./KpiGrid";
import { SimpleBarChart } from "./SimpleBarChart";
import { SimpleDonutChart } from "./SimpleDonutChart";
import styles from "./OverviewAnalyticsView.module.css";

type OverviewAnalyticsViewProps = {
  data: OverviewAnalytics;
};

type TeamWorkloadRow = {
  id: string;
  name: string;
  role: string;
  openTasks: number;
  activeClients: number;
};

const DISTRIBUTION_COLORS = ["#c084fc", "#34d399", "#60a5fa", "#f59e0b"];

function formatDelta(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}%`;
}

export function OverviewAnalyticsView({ data }: OverviewAnalyticsViewProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("analytics");

  const kpiItems = [
    {
      key: "activeClients",
      value: String(data.kpis.activeClients),
      icon: "fa-solid fa-users",
      delta: data.comparison.activeClientsDelta,
    },
    {
      key: "newLeads",
      value: String(data.kpis.newLeads),
      icon: "fa-solid fa-user-plus",
      delta: data.comparison.newLeadsDelta,
    },
    {
      key: "completedCases",
      value: String(data.kpis.completedCases),
      icon: "fa-solid fa-circle-check",
      delta: data.comparison.completedCasesDelta,
    },
    {
      key: "overdueTasks",
      value: String(data.kpis.overdueTasks),
      icon: "fa-solid fa-triangle-exclamation",
      delta: data.comparison.overdueTasksDelta,
    },
    {
      key: "upcomingDeadlines",
      value: String(data.kpis.upcomingDeadlines),
      icon: "fa-solid fa-calendar-day",
    },
    {
      key: "avgProcessingDays",
      value: `${data.kpis.avgProcessingDays} ${t("charts.daysUnit")}`,
      icon: "fa-solid fa-clock",
    },
    {
      key: "taskCompletionRate",
      value: `${data.kpis.taskCompletionRate}%`,
      icon: "fa-solid fa-chart-line",
    },
  ] as const;

  const teamRows: TeamWorkloadRow[] = data.teamWorkload.map((row) => ({
    id: row.memberId,
    name: row.name,
    role: translateRole(locale, row.role),
    openTasks: row.openTasks,
    activeClients: row.activeClients,
  }));

  const distributionSlices = data.clientDistribution.map((row, index) => ({
    key: row.direction,
    label: row.direction,
    value: row.count,
    share: row.share,
    color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]!,
  }));

  return (
    <div className={styles.page}>
      <AnalyticsBlock title={t("overview.title")} subtitle={t("overview.subtitle")}>
        <KpiGrid
          columns={3}
          items={kpiItems.map((item) => ({
            label: t(`overview.kpis.${item.key}`),
            value: item.value,
            icon: item.icon,
            hint:
              "delta" in item && item.delta !== undefined
                ? `${t("overview.comparison.vsPreviousPeriod")}: ${formatDelta(item.delta)}`
                : undefined,
          }))}
        />
      </AnalyticsBlock>

      <AnalyticsBlock
        title={t("overview.charts.monthlyActivity")}
        subtitle={t("overview.charts.monthlyActivityHint")}
      >
        <SimpleBarChart
          points={data.monthlyActivity.map((point) => ({
            label: point.label,
            values: {
              newLeads: point.newLeads,
              completedCases: point.completedCases,
              tasksClosed: point.tasksClosed,
            },
          }))}
          series={[
            { key: "newLeads", label: t("overview.kpis.newLeads"), color: "#c084fc" },
            {
              key: "completedCases",
              label: t("overview.kpis.completedCases"),
              color: "#34d399",
            },
            {
              key: "tasksClosed",
              label: t("overview.charts.tasksClosed"),
              color: "#60a5fa",
            },
          ]}
        />
      </AnalyticsBlock>

      <div className={styles.split}>
        <AnalyticsBlock title={t("overview.charts.teamWorkload")}>
          <AnalyticsTable
            rows={teamRows}
            getRowKey={(row) => row.id}
            columns={[
              {
                key: "name",
                header: t("overview.tables.member"),
                render: (row) => row.name,
              },
              {
                key: "role",
                header: t("overview.tables.role"),
                render: (row) => row.role,
              },
              {
                key: "openTasks",
                header: t("overview.tables.openTasks"),
                align: "right",
                render: (row) => row.openTasks,
              },
              {
                key: "activeClients",
                header: t("overview.tables.activeClients"),
                align: "right",
                render: (row) => row.activeClients,
              },
            ]}
          />
        </AnalyticsBlock>

        <AnalyticsBlock title={t("overview.charts.clientDistribution")}>
          <SimpleDonutChart slices={distributionSlices} />
        </AnalyticsBlock>
      </div>
    </div>
  );
}
