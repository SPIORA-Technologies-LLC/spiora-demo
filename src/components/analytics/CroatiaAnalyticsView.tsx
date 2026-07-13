"use client";

import { useTranslations } from "next-intl";
import { formatDays } from "@/lib/analytics/dates";
import type { CroatiaAnalytics } from "@/lib/analytics/types";
import { AnalyticsBlock } from "./AnalyticsBlock";
import { AnalyticsTable } from "./AnalyticsTable";
import { KpiGrid } from "./KpiGrid";
import { SimpleBarChart } from "./SimpleBarChart";
import { SimpleLineChart } from "./SimpleLineChart";
import styles from "./CroatiaAnalyticsView.module.css";

type CroatiaAnalyticsViewProps = {
  data: CroatiaAnalytics;
};

function trendIcon(trend: CroatiaAnalytics["processingTimes"]["trend"]) {
  if (trend === "accelerating") return "fa-arrow-trend-down";
  if (trend === "slowing") return "fa-arrow-trend-up";
  if (trend === "stable") return "fa-minus";
  return "fa-circle-question";
}

export function CroatiaAnalyticsView({ data }: CroatiaAnalyticsViewProps) {
  const t = useTranslations("analytics");
  const daysUnit = t("charts.daysUnit");
  const fmtDays = (value: number | null) => formatDays(value, daysUnit);

  const loadBadge = (level: "low" | "medium" | "high") =>
    t(`croatia.loadBadges.${level}`);

  const barPoints = data.monthlyTrend.map((m) => ({
    label: m.label,
    values: { submitted: m.submitted, approved: m.approved },
  }));

  return (
    <div className={styles.page}>
      <AnalyticsBlock
        title={t("croatia.overview.title")}
        subtitle={t("croatia.overview.subtitle")}
      >
        <KpiGrid
          items={[
            {
              label: t("croatia.overview.kpis.submitted"),
              value: String(data.overview.submitted),
              icon: "fa-solid fa-file-import",
            },
            {
              label: t("croatia.overview.kpis.approved"),
              value: String(data.overview.approved),
              icon: "fa-solid fa-passport",
            },
            {
              label: t("croatia.overview.kpis.activeCases"),
              value: String(data.overview.activeCases),
              icon: "fa-solid fa-briefcase",
            },
            {
              label: t("croatia.overview.kpis.avgProcessingDays"),
              value: fmtDays(data.overview.avgProcessingDays),
              icon: "fa-solid fa-clock",
            },
            {
              label: t("croatia.overview.kpis.fastestDays"),
              value: fmtDays(data.overview.fastestDays),
              icon: "fa-solid fa-bolt",
            },
            {
              label: t("croatia.overview.kpis.slowestDays"),
              value: fmtDays(data.overview.slowestDays),
              icon: "fa-solid fa-hourglass-end",
            },
          ]}
          columns={3}
        />
        <SimpleBarChart
          points={barPoints}
          series={[
            {
              key: "submitted",
              label: t("croatia.overview.charts.submittedMonthly"),
              color: "rgba(232, 41, 22, 0.85)",
            },
            {
              key: "approved",
              label: t("croatia.overview.charts.approvedMonthly"),
              color: "rgba(74, 222, 128, 0.85)",
            },
          ]}
        />
      </AnalyticsBlock>

      <AnalyticsBlock
        title={t("croatia.processing.title")}
        subtitle={t("croatia.processing.subtitle")}
      >
        <KpiGrid
          items={[
            {
              label: t("croatia.processing.kpis.avgProcessingDays"),
              value: fmtDays(data.processingTimes.avgProcessingDays),
            },
            {
              label: t("croatia.processing.kpis.last30Days"),
              value: fmtDays(data.processingTimes.avgLast30Days),
            },
            {
              label: t("croatia.processing.kpis.last90Days"),
              value: fmtDays(data.processingTimes.avgLast90Days),
            },
            {
              label: t("croatia.processing.kpis.trend"),
              value: t(`croatia.processing.trends.${data.processingTimes.trend}`),
              icon: `fa-solid ${trendIcon(data.processingTimes.trend)}`,
            },
          ]}
          columns={4}
        />
        <SimpleLineChart points={data.processingTimes.monthlyAvg} unit={daysUnit} />
      </AnalyticsBlock>

      <AnalyticsBlock
        title={t("croatia.inspectors.title")}
        subtitle={t("croatia.inspectors.subtitle")}
      >
        <AnalyticsTable
          rows={data.inspectors}
          getRowKey={(r) => r.inspector}
          columns={[
            {
              key: "inspector",
              header: t("croatia.inspectors.table.inspector"),
              render: (r) => r.inspector,
            },
            {
              key: "active",
              header: t("croatia.inspectors.table.activeCases"),
              align: "right",
              render: (r) => r.activeCases,
            },
            {
              key: "completed",
              header: t("croatia.inspectors.table.completed"),
              align: "right",
              render: (r) => r.completedCases,
            },
            {
              key: "avg",
              header: t("croatia.inspectors.table.avgProcessingDays"),
              align: "right",
              render: (r) => fmtDays(r.avgProcessingDays),
            },
            {
              key: "fast",
              header: t("croatia.inspectors.table.fastest"),
              align: "right",
              render: (r) => fmtDays(r.fastestDays),
            },
            {
              key: "slow",
              header: t("croatia.inspectors.table.slowest"),
              align: "right",
              render: (r) => fmtDays(r.slowestDays),
            },
          ]}
        />
      </AnalyticsBlock>

      <AnalyticsBlock
        title={t("croatia.forecasts.title")}
        subtitle={t("croatia.forecasts.subtitle")}
      >
        <AnalyticsTable
          rows={data.forecasts}
          getRowKey={(r) => r.clientId}
          emptyText={t("croatia.forecasts.empty")}
          columns={[
            {
              key: "name",
              header: t("croatia.forecasts.table.client"),
              render: (r) => r.clientName,
            },
            {
              key: "inspector",
              header: t("croatia.forecasts.table.inspector"),
              render: (r) => r.inspector,
            },
            {
              key: "days",
              header: t("croatia.forecasts.table.daysInWork"),
              align: "right",
              render: (r) => r.daysInWork,
            },
            {
              key: "avg",
              header: t("croatia.forecasts.table.inspectorAvgDays"),
              align: "right",
              render: (r) => fmtDays(r.inspectorAvgDays),
            },
            {
              key: "predicted",
              header: t("croatia.forecasts.table.predictedDecision"),
              render: (r) => r.predictedDecisionAt ?? "—",
            },
          ]}
        />
      </AnalyticsBlock>

      <AnalyticsBlock
        title={t("croatia.visaD.title")}
        subtitle={t("croatia.visaD.subtitle")}
      >
        <KpiGrid
          items={[
            {
              label: t("croatia.visaD.kpis.submitted"),
              value: String(data.visaD.overview.submitted),
            },
            {
              label: t("croatia.visaD.kpis.issued"),
              value: String(data.visaD.overview.issued),
            },
            {
              label: t("croatia.visaD.kpis.rejected"),
              value: String(data.visaD.overview.rejected),
            },
            {
              label: t("croatia.visaD.kpis.approvalRate"),
              value: `${data.visaD.overview.approvalRate}%`,
            },
            {
              label: t("croatia.visaD.kpis.rejectionRate"),
              value: `${data.visaD.overview.rejectionRate}%`,
            },
            {
              label: t("croatia.visaD.kpis.avgProcessingDays"),
              value: fmtDays(data.visaD.overview.avgProcessingDays),
            },
          ]}
          columns={3}
        />
        <AnalyticsTable
          rows={data.visaD.consulates}
          getRowKey={(r) => r.consulate}
          columns={[
            {
              key: "c",
              header: t("croatia.visaD.table.consulate"),
              render: (r) => r.consulate,
            },
            {
              key: "s",
              header: t("croatia.visaD.table.submitted"),
              align: "right",
              render: (r) => r.submitted,
            },
            {
              key: "a",
              header: t("croatia.visaD.table.approved"),
              align: "right",
              render: (r) => r.approved,
            },
            {
              key: "r",
              header: t("croatia.visaD.table.rejected"),
              align: "right",
              render: (r) => r.rejected,
            },
            {
              key: "rate",
              header: t("croatia.visaD.table.approvalRate"),
              align: "right",
              render: (r) => `${r.approvalRate}%`,
            },
            {
              key: "avg",
              header: t("croatia.visaD.table.avgProcessingDays"),
              align: "right",
              render: (r) => fmtDays(r.avgProcessingDays),
            },
          ]}
        />
      </AnalyticsBlock>

      <AnalyticsBlock
        title={t("croatia.addresses.title")}
        subtitle={t("croatia.addresses.subtitle")}
      >
        <AnalyticsTable
          rows={data.addresses}
          getRowKey={(r) => r.address}
          emptyText={t("croatia.addresses.empty")}
          columns={[
            {
              key: "addr",
              header: t("croatia.addresses.table.address"),
              render: (r) => r.address,
            },
            {
              key: "active",
              header: t("croatia.addresses.table.activeClients"),
              align: "right",
              render: (r) => r.activeClients,
            },
            {
              key: "total",
              header: t("croatia.addresses.table.totalClients"),
              align: "right",
              render: (r) => r.totalClients,
            },
            {
              key: "approved",
              header: t("croatia.addresses.table.approved"),
              align: "right",
              render: (r) => r.approvedCount,
            },
            {
              key: "load",
              header: t("croatia.addresses.table.load"),
              render: (r) => loadBadge(r.loadLevel),
            },
          ]}
        />
      </AnalyticsBlock>

      <AnalyticsBlock title={t("croatia.addressLoad.title")}>
        <KpiGrid
          items={[
            {
              label: t("croatia.addressLoad.kpis.uniqueAddresses"),
              value: String(data.addressLoad.uniqueAddresses),
            },
            {
              label: t("croatia.addressLoad.kpis.overFiveClients"),
              value: String(data.addressLoad.overFiveClients),
            },
            {
              label: t("croatia.addressLoad.kpis.overTenClients"),
              value: String(data.addressLoad.overTenClients),
            },
          ]}
          columns={3}
        />
        <p className={styles.loadHint}>{t("croatia.addressLoad.loadHint")}</p>
      </AnalyticsBlock>
    </div>
  );
}
