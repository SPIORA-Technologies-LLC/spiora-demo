"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { SessionUser } from "@/lib/auth/types";
import type { CompanyHealthMetrics } from "@/lib/dashboard/company-health";
import type { CommandCenterDailyBriefing } from "@/lib/dashboard/daily-briefing";
import type { AppLocale } from "@/i18n/config";
import { AskSpioraPanel } from "./AskSpioraPanel";
import { CommandCenterDatePicker } from "./CommandCenterDatePicker";
import styles from "./FirstImpressionView.module.css";

type FirstImpressionViewProps = {
  user: SessionUser;
  health: CompanyHealthMetrics;
  briefing: CommandCenterDailyBriefing;
  dayKey: string;
  todayKey: string;
  minDayKey: string;
  maxDayKey: string;
  loading?: boolean;
  error?: string | null;
  onSelectDay: (dayKey: string) => void;
};

function toneClass(tone: "good" | "attention" | "critical"): string {
  if (tone === "good") return styles.toneGood;
  if (tone === "attention") return styles.toneAttention;
  return styles.toneCritical;
}

function toneIcon(tone: "good" | "attention" | "critical"): string {
  if (tone === "good") return "🟢";
  if (tone === "attention") return "🟡";
  return "🔴";
}

function formatBriefingDay(dayKey: string, locale: AppLocale): string {
  const ts = Date.parse(`${dayKey}T12:00:00+03:00`);
  if (Number.isNaN(ts)) return dayKey;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(ts));
}

export function FirstImpressionView({
  user,
  health,
  briefing,
  dayKey,
  todayKey,
  minDayKey,
  maxDayKey,
  loading = false,
  error = null,
  onSelectDay,
}: FirstImpressionViewProps) {
  const t = useTranslations("commandCenter");
  const locale = useLocale() as AppLocale;
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  const numberLocale = locale === "ru" ? "ru-RU" : "en-US";
  const isToday = dayKey === todayKey;
  const formattedDay = formatBriefingDay(dayKey, locale);

  return (
    <div className={styles.page}>
      <header className={`${styles.hero} ${styles.fadeInUp}`}>
        <div className={styles.heroGlow} aria-hidden />
        <p className={styles.greeting}>
          {t("greeting", { name: firstName })}
        </p>
        <h1 className={styles.calmHeadline}>{t("calmHeadline")}</h1>
        <div className={styles.heroMeta}>
          <p className={styles.heroLead}>
            {isToday
              ? t("daily.heroLead", { dayKey })
              : t("daily.heroLeadPast", { date: formattedDay, dayKey })}
          </p>
          <CommandCenterDatePicker
            dayKey={dayKey}
            todayKey={todayKey}
            minDayKey={minDayKey}
            maxDayKey={maxDayKey}
            loading={loading}
            onSelectDay={onSelectDay}
          />
        </div>
        {error ? (
          <p className={styles.datePickerError} role="alert">
            {t("daily.datePicker.error")}
          </p>
        ) : null}
      </header>

      <div
        className={loading ? styles.contentLoading : undefined}
        aria-busy={loading}
      >
        <section
          className={`${styles.panel} ${styles.executiveSummary} ${styles.fadeInUp}`}
          style={{ animationDelay: "80ms" }}
          aria-labelledby="executive-summary-title"
        >
          <h2 id="executive-summary-title" className={styles.panelTitle}>
            {t("executiveSummary.title")}
          </h2>
          <div className={styles.summaryBody}>
            {briefing.summary.map((line) => (
              <p
                key={line.key}
                className={line.accent ? styles.summaryAccent : undefined}
              >
                {t(line.key, line.values ?? {})}
              </p>
            ))}
          </div>
        </section>

        <section
          className={`${styles.fadeInUp}`}
          style={{ animationDelay: "160ms" }}
          aria-labelledby="priorities-title"
        >
          <h2 id="priorities-title" className={styles.sectionTitle}>
            {t("priorities.title")}
          </h2>
          <ul className={styles.priorityGrid}>
            {briefing.priorities.map((card) => (
              <li key={card.id}>
                {card.href ? (
                  <Link href={card.href} className={styles.priorityLink}>
                    <article
                      className={[styles.priorityCard, toneClass(card.tone)].join(
                        " ",
                      )}
                    >
                      <span className={styles.priorityIcon} aria-hidden>
                        {toneIcon(card.tone)}
                      </span>
                      <p className={styles.priorityText}>
                        {t(card.key, card.values ?? {})}
                      </p>
                    </article>
                  </Link>
                ) : (
                  <article
                    className={[styles.priorityCard, toneClass(card.tone)].join(
                      " ",
                    )}
                  >
                    <span className={styles.priorityIcon} aria-hidden>
                      {toneIcon(card.tone)}
                    </span>
                    <p className={styles.priorityText}>
                      {t(card.key, card.values ?? {})}
                    </p>
                  </article>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`${styles.panel} ${styles.insightsPanel} ${styles.fadeInUp}`}
          style={{ animationDelay: "240ms" }}
          aria-labelledby="ai-insights-title"
        >
          <h2 id="ai-insights-title" className={styles.panelTitle}>
            {t("daily.insightsTitle")}
          </h2>
          {briefing.insights.length > 0 ? (
            <ul className={styles.insightsList}>
              {briefing.insights.map((insight) => (
                <li key={insight.id}>
                  {insight.href ? (
                    <Link href={insight.href} className={styles.insightLink}>
                      {t(insight.key, insight.values ?? {})}
                    </Link>
                  ) : (
                    <span>{t(insight.key, insight.values ?? {})}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.summaryBody}>{t("daily.noInsights")}</p>
          )}
        </section>

        <AskSpioraPanel />

        <section
          className={`${styles.panel} ${styles.healthPanel} ${styles.fadeInUp}`}
          style={{ animationDelay: "400ms" }}
          aria-labelledby="company-health-title"
        >
          <div className={styles.healthHeader}>
            <h2 id="company-health-title" className={styles.panelTitle}>
              {t("companyHealth.title")}
            </h2>
            <span className={styles.healthBadge}>
              <span className={styles.healthDot} aria-hidden />
              {t(`companyHealth.status.${health.statusKey}`)}
            </span>
          </div>
          <dl className={styles.healthGrid}>
            <div>
              <dt>{t("companyHealth.clients")}</dt>
              <dd>{health.clients.toLocaleString(numberLocale)}</dd>
            </div>
            <div>
              <dt>{t("companyHealth.documents")}</dt>
              <dd>{health.documents.toLocaleString(numberLocale)}</dd>
            </div>
            <div>
              <dt>{t("companyHealth.meetings")}</dt>
              <dd>{health.meetings.toLocaleString(numberLocale)}</dd>
            </div>
            <div>
              <dt>{t("companyHealth.tasksCompleted")}</dt>
              <dd>{health.tasksCompletedPercent}%</dd>
            </div>
            <div>
              <dt>{t("companyHealth.aiConversations")}</dt>
              <dd>{health.aiConversations.toLocaleString(numberLocale)}</dd>
            </div>
          </dl>
          {health.statusKey === "empty" ? (
            <p className={styles.summaryAccent}>{t("companyHealth.emptyState")}</p>
          ) : null}
        </section>

        <section
          className={`${styles.panel} ${styles.activityPanel} ${styles.fadeInUp}`}
          style={{ animationDelay: "480ms" }}
          aria-labelledby="team-activity-title"
        >
          <h2 id="team-activity-title" className={styles.panelTitle}>
            {t("activity.title")}
          </h2>
          {briefing.activity.length > 0 ? (
            <ul className={styles.activityList}>
              {briefing.activity.map((item) => (
                <li key={item.id} className={styles.activityItem}>
                  <span className={styles.activityDot} aria-hidden />
                  {item.href ? (
                    <Link href={item.href} className={styles.activityLink}>
                      {t(item.key, item.values ?? {})}
                    </Link>
                  ) : (
                    <span>{t(item.key, item.values ?? {})}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.summaryBody}>
              {isToday
                ? t("daily.activity.empty")
                : t("daily.activity.emptyForDay")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
