"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/i18n/config";
import type { FinanceAnalyticsResult } from "@/lib/finance/types";
import { FINANCE_DIRECTIONS } from "@/lib/finance/directions";
import { formatEuroFromCents } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  SimpleDonutChart,
  type DonutSlice,
} from "@/components/analytics/SimpleDonutChart";
import styles from "./FinanceAnalyticsView.module.css";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const MONTH_COLORS = [
  "#22c55e",
  "#34d399",
  "#4ade80",
  "#86efac",
  "#f59e0b",
  "#fbbf24",
  "#60a5fa",
  "#38bdf8",
  "#c084fc",
  "#f472b6",
  "#fb7185",
  "#2dd4bf",
];

const CONTRACT_COLORS = [
  "#f59e0b",
  "#fbbf24",
  "#fb923c",
  "#fdba74",
  "#22c55e",
  "#34d399",
  "#60a5fa",
  "#38bdf8",
  "#c084fc",
  "#f472b6",
  "#fb7185",
  "#2dd4bf",
];

export function FinanceAnalyticsView() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.analytics");
  const tDir = useTranslations("finance.directions");

  const currentYear = new Date().getFullYear();
  const [periodType, setPeriodType] = useState<"month" | "year">("year");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [direction, setDirection] = useState("all");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceAnalyticsResult | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("periodType", periodType);
    params.set("year", String(year));
    if (periodType === "month") params.set("month", String(month));
    if (direction && direction !== "all") params.set("direction", direction);
    return params.toString();
  }, [periodType, year, month, direction]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/analytics?${queryString}`);
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { analytics?: FinanceAnalyticsResult };
      setData(json.analytics ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const fmt = useCallback(
    (cents: number | null | undefined) => formatEuroFromCents(cents, locale),
    [locale],
  );

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const receivedSlices: DonutSlice[] = useMemo(() => {
    if (!data?.monthly) return [];
    return data.monthly.map((m, index) => ({
      key: m.labelKey,
      label: t(`months.${m.labelKey}`),
      value: Math.round(m.receivedCents / 100),
      color: MONTH_COLORS[index % MONTH_COLORS.length]!,
    }));
  }, [data, t]);

  const contractsSlices: DonutSlice[] = useMemo(() => {
    if (!data?.monthly) return [];
    return data.monthly.map((m, index) => ({
      key: m.labelKey,
      label: t(`months.${m.labelKey}`),
      value: Math.round(m.contractsSignedCents / 100),
      color: CONTRACT_COLORS[index % CONTRACT_COLORS.length]!,
    }));
  }, [data, t]);

  const receivedTotal = useMemo(
    () => receivedSlices.reduce((sum, slice) => sum + slice.value, 0),
    [receivedSlices],
  );
  const contractsTotal = useMemo(
    () => contractsSlices.reduce((sum, slice) => sum + slice.value, 0),
    [contractsSlices],
  );

  return (
    <div className={styles.wrap} aria-busy={loading}>
      <Link href="/finance" className={styles.back}>
        <i className="fa-solid fa-arrow-left" aria-hidden /> {t("backToFinance")}
      </Link>

      <SectionHeader title={t("title")} />

      {/* Filters */}
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as "month" | "year")}
        >
          <option value="year">{t("periodYear")}</option>
          <option value="month">{t("periodMonth")}</option>
        </select>
        <select
          className={styles.select}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {periodType === "month" ? (
          <select
            className={styles.select}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{t(`months.m${m}`)}</option>
            ))}
          </select>
        ) : null}
        <select
          className={styles.select}
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="all">{t("allDirections")}</option>
          {FINANCE_DIRECTIONS.map((d) => (
            <option key={d} value={d}>{tDir(d)}</option>
          ))}
        </select>
      </div>

      {/* KPI cards — only 4 analytics KPIs, no debt */}
      {data ? (
        <ul className={styles.kpiRow}>
          <li className={styles.kpiCard}>
            <span className={styles.kpiValue}>{fmt(data.contractsSignedCents)}</span>
            <span className={styles.kpiLabel}>{t("kpi.contractsSigned")}</span>
          </li>
          <li className={styles.kpiCard}>
            <span className={styles.kpiValue}>{String(data.newClientsCount)}</span>
            <span className={styles.kpiLabel}>{t("kpi.newClients")}</span>
          </li>
          <li className={styles.kpiCard}>
            <span className={styles.kpiValue}>{fmt(data.receivedCents)}</span>
            <span className={styles.kpiLabel}>{t("kpi.received")}</span>
          </li>
          <li className={styles.kpiCard}>
            <span className={styles.kpiValue}>{String(data.paymentsCount)}</span>
            <span className={styles.kpiLabel}>{t("kpi.paymentsCount")}</span>
          </li>
        </ul>
      ) : loading ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : (
        <p className={styles.empty}>{t("noData")}</p>
      )}

      {/* Charts */}
      {data?.monthly && data.monthly.length > 0 ? (
        <div className={styles.charts}>
          <Card className={styles.chartPanel}>
            <h2 className={styles.chartTitle}>{t("chartReceivedTitle")}</h2>
            <SimpleDonutChart
              slices={receivedSlices}
              ariaLabel={t("chartReceivedTitle")}
              centerLabel={t("chartReceived")}
              centerValue={fmt(receivedTotal * 100)}
              emptyText={t("noData")}
              formatValue={(value) => fmt(value * 100)}
            />
          </Card>
          <Card className={styles.chartPanel}>
            <h2 className={styles.chartTitle}>{t("chartContractsTitle")}</h2>
            <SimpleDonutChart
              slices={contractsSlices}
              ariaLabel={t("chartContractsTitle")}
              centerLabel={t("chartContracts")}
              centerValue={fmt(contractsTotal * 100)}
              emptyText={t("noData")}
              formatValue={(value) => fmt(value * 100)}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
