"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast, type ToastMessage } from "@/components/tasks/Toast";
import type { AppLocale } from "@/i18n/config";
import { exportCroatiaExcel, exportCroatiaPdf } from "@/lib/analytics/export";
import { resolvePeriodRange, type PeriodPreset } from "@/lib/analytics/period";
import type {
  AnalyticsSection,
  CroatiaAnalytics,
  OverviewAnalytics,
} from "@/lib/analytics/types";
import { AnalyticsBlock } from "./AnalyticsBlock";
import { CroatiaAnalyticsView } from "./CroatiaAnalyticsView";
import { OverviewAnalyticsView } from "./OverviewAnalyticsView";
import { PeriodFilter } from "./PeriodFilter";
import styles from "./AnalyticsView.module.css";

const SECTIONS: Array<{ id: AnalyticsSection; icon: string }> = [
  { id: "overview", icon: "fa-chart-pie" },
  { id: "croatia", icon: "fa-flag" },
  { id: "spain", icon: "fa-flag" },
];

const PLACEHOLDER_BLOCK_KEYS: Record<"spain", string[]> = {
  spain: [
    "generalStats",
    "applicantTypeStats",
    "monthlyQuarterlyDynamics",
    "processingTimes",
    "familyApplications",
  ],
};

function defaultCustomRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function isClientDemoMode(
  overviewDemo?: boolean,
  croatiaSource?: CroatiaAnalytics["source"],
): boolean {
  return (
    overviewDemo === true ||
    croatiaSource === "demo" ||
    process.env.NEXT_PUBLIC_SPIORA_DEMO_MODE?.trim().toLowerCase() === "true"
  );
}

function formatLocaleDate(date: Date, locale: AppLocale): string {
  const intlTag = locale === "ru" ? "ru-RU" : "en-US";
  return date.toLocaleDateString(intlTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AnalyticsView() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("analytics");
  const tDemo = useTranslations("demoGuard");

  const [section, setSection] = useState<AnalyticsSection>("overview");
  const [preset, setPreset] = useState<PeriodPreset>("current_month");
  const [customFrom, setCustomFrom] = useState(defaultCustomRange().from);
  const [customTo, setCustomTo] = useState(defaultCustomRange().to);
  const [overviewData, setOverviewData] = useState<OverviewAnalytics | null>(null);
  const [croatiaData, setCroatiaData] = useState<CroatiaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const range = resolvePeriodRange(preset, customFrom, customTo);
  const periodLabel = useMemo(() => {
    if (preset === "custom") {
      return `${formatLocaleDate(range.from, locale)} — ${formatLocaleDate(range.to, locale)}`;
    }
    return t(`period.presets.${preset}`);
  }, [locale, preset, range.from, range.to, t]);

  const isDemo = isClientDemoMode(overviewData?.demo, croatiaData?.source);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/overview");
      if (!res.ok) throw new Error(t("states.loadFailed"));
      const json = (await res.json()) as OverviewAnalytics;
      setOverviewData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("states.error"));
      setOverviewData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadCroatia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ preset });
      if (preset === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const res = await fetch(`/api/analytics/croatia?${params.toString()}`);
      if (!res.ok) throw new Error(t("states.loadFailed"));
      const json = (await res.json()) as CroatiaAnalytics;
      setCroatiaData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("states.error"));
      setCroatiaData(null);
    } finally {
      setLoading(false);
    }
  }, [customFrom, customTo, preset, t]);

  useEffect(() => {
    if (section === "overview") {
      void loadOverview();
      return;
    }
    if (section === "croatia") {
      void loadCroatia();
      return;
    }
    setLoading(false);
    setError(null);
  }, [section, loadCroatia, loadOverview]);

  const handleExportExcel = () => {
    if (isDemo) {
      setToast({ text: tDemo("analyticsExport"), type: "error" });
      return;
    }
    if (croatiaData) exportCroatiaExcel(croatiaData);
  };

  const handleExportPdf = () => {
    if (isDemo) {
      setToast({ text: tDemo("analyticsExport"), type: "error" });
      return;
    }
    exportCroatiaPdf();
  };

  const formatUpdatedAt = (value: string) =>
    new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US");

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {SECTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={section === tab.id ? styles.tabActive : styles.tab}
              onClick={() => setSection(tab.id)}
            >
              <i className={`fa-solid ${tab.icon}`} aria-hidden />
              {t(`sections.${tab.id}`)}
            </button>
          ))}
        </div>
        <div className={styles.exportRow}>
          {isDemo ? (
            <span className={styles.demoBadge}>{t("demoBadge")}</span>
          ) : null}
          <Button
            type="button"
            className={styles.exportBtn}
            disabled={!croatiaData || section !== "croatia" || isDemo}
            onClick={handleExportExcel}
          >
            <i className="fa-solid fa-file-excel" aria-hidden />
            {t("export.excel")}
          </Button>
          <Button
            type="button"
            className={styles.exportBtn}
            disabled={section !== "croatia" || !croatiaData || isDemo}
            onClick={handleExportPdf}
          >
            <i className="fa-solid fa-file-pdf" aria-hidden />
            {t("export.pdf")}
          </Button>
        </div>
      </div>

      <PeriodFilter
        preset={preset}
        customFrom={customFrom}
        customTo={customTo}
        periodLabel={periodLabel}
        onPresetChange={setPreset}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />

      {section === "overview" ? (
        <>
          {loading ? (
            <Card className={styles.stateCard}>{t("states.loading")}</Card>
          ) : error ? (
            <Card className={styles.stateCard}>{error}</Card>
          ) : overviewData ? (
            <>
              <p className={styles.meta}>
                {t("meta.sourceDemo")} · {t("meta.updated")}:{" "}
                {formatUpdatedAt(overviewData.generatedAt)}
              </p>
              <div className={styles.printArea}>
                <OverviewAnalyticsView data={overviewData} />
              </div>
            </>
          ) : null}
        </>
      ) : section === "croatia" ? (
        <>
          {loading ? (
            <Card className={styles.stateCard}>{t("states.loading")}</Card>
          ) : error ? (
            <Card className={styles.stateCard}>{error}</Card>
          ) : croatiaData ? (
            <>
              <p className={styles.meta}>
                {croatiaData.source === "google_sheets"
                  ? t("meta.sourceSheets")
                  : t("meta.sourceDemo")}{" "}
                · {t("meta.updated")}:{" "}
                {formatUpdatedAt(croatiaData.generatedAt)}
              </p>
              <div className={styles.printArea}>
                <CroatiaAnalyticsView data={croatiaData} />
              </div>
            </>
          ) : null}
        </>
      ) : (
        <AnalyticsBlock
          title={t(`${section}.title`)}
          subtitle={t(`${section}.subtitle`)}
        >
          <Card className={styles.placeholderCard}>
            <p className={styles.placeholderLead}>
              {t(`${section}.placeholderLead`)}
            </p>
            <p className={styles.placeholderFuture}>
              {t(`${section}.placeholderFuture`)}
            </p>
            <ul className={styles.placeholderList}>
              {PLACEHOLDER_BLOCK_KEYS[section].map((blockKey) => (
                <li key={blockKey}>{t(`${section}.blocks.${blockKey}`)}</li>
              ))}
            </ul>
          </Card>
        </AnalyticsBlock>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
