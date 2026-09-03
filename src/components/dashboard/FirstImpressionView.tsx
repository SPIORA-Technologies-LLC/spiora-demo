"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { SessionUser } from "@/lib/auth/types";
import type { CompanyHealthMetrics } from "@/lib/dashboard/company-health";
import type {
  BriefingActivityItem,
  CommandCenterDailyBriefing,
} from "@/lib/dashboard/daily-briefing";
import {
  parseLlmSummaryBlocks,
} from "@/lib/dashboard/daily-briefing-llm-format";
import type { AppLocale } from "@/i18n/config";
import { formatEuroFromCents } from "@/lib/finance/money";
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
  activityItems: BriefingActivityItem[];
  activityTotal: number;
  activityNextCursor: string | null;
  activityLoadingMore?: boolean;
  onLoadMoreActivity: () => void;
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
  activityItems,
  activityTotal,
  activityNextCursor,
  activityLoadingMore = false,
  onLoadMoreActivity,
}: FirstImpressionViewProps) {
  const t = useTranslations("commandCenter");
  const tFinanceStatus = useTranslations("finance.status");
  const locale = useLocale() as AppLocale;
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  const numberLocale = locale === "ru" ? "ru-RU" : "en-US";
  const isToday = dayKey === todayKey;
  const formattedDay = formatBriefingDay(dayKey, locale);
  const llmBlocks = briefing.llmSummary
    ? parseLlmSummaryBlocks(briefing.llmSummary)
    : [];

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
        className={[
          styles.contentStack,
          loading ? styles.contentLoading : "",
        ]
          .filter(Boolean)
          .join(" ")}
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
        {llmBlocks.length > 0 ? (
          <div className={styles.summaryBody}>
            {llmBlocks.map((block, index) =>
              block.kind === "subheading" ? (
                <h3
                  key={`sub-${index}-${block.text.slice(0, 32)}`}
                  className={styles.summarySubheading}
                >
                  {block.text}
                </h3>
              ) : (
                <p key={`p-${index}-${block.text.slice(0, 32)}`}>{block.text}</p>
              ),
            )}
            <p className={styles.llmSummaryNote}>{t("daily.llmSummaryNote")}</p>
          </div>
        ) : (
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
        )}
        </section>

        <section
          className={`${styles.panel} ${styles.contractsPanel} ${styles.fadeInUp}`}
          style={{ animationDelay: "200ms" }}
          aria-labelledby="pending-contracts-title"
        >
          <h2 id="pending-contracts-title" className={styles.panelTitle}>
            {t("contracts.title")}
          </h2>
          {briefing.pendingSignatures.length > 0 ? (
            <ul className={styles.contractsList}>
              {briefing.pendingSignatures.map((item) => (
                <li key={item.id} className={styles.contractsItem}>
                  <Link href={item.href} className={styles.contractsLink}>
                    <span className={styles.contractsClient}>{item.clientName}</span>
                    <span className={styles.contractsMeta}>
                      {t("contracts.agreementNumber", {
                        number: item.agreementNumber,
                      })}{" "}
                      ·{" "}
                      {item.status === "awaiting_client_signature"
                        ? t("contracts.awaitingClient")
                        : t("contracts.awaitingProvider")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.summaryBody}>{t("contracts.empty")}</p>
          )}
        </section>

        {briefing.finance ? (
          <section
            className={`${styles.panel} ${styles.financePanel} ${styles.fadeInUp}`}
            style={{ animationDelay: "220ms" }}
            aria-labelledby="command-center-finance-title"
          >
            <div className={styles.financeHead}>
              <h2 id="command-center-finance-title" className={styles.panelTitle}>
                {t("finance.title")}
              </h2>
              <Link href="/finance" className={styles.financeViewAll}>
                {t("finance.viewAll")}
              </Link>
            </div>
            <dl className={styles.financeKpis}>
              <div>
                <dt>{t("finance.contractsTotal")}</dt>
                <dd>
                  {formatEuroFromCents(
                    briefing.finance.totalContractsCents,
                    locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("finance.received")}</dt>
                <dd>
                  {formatEuroFromCents(
                    briefing.finance.totalReceivedCents,
                    locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("finance.debt")}</dt>
                <dd>
                  {formatEuroFromCents(briefing.finance.totalDebtCents, locale)}
                </dd>
              </div>
            </dl>
            <p className={styles.financeDebtSummary}>
              {t("finance.clientsWithDebt", {
                count: briefing.finance.clientsWithDebt,
              })}
            </p>
            {briefing.finance.debtors.length > 0 ? (
              <>
                <h3 className={styles.financeSubTitle}>
                  {t("finance.debtorsTitle")}
                </h3>
                <ul className={styles.financeDebtors}>
                  {briefing.finance.debtors.map((debtor) => (
                    <li key={debtor.clientExternalId}>
                      <Link href={debtor.href} className={styles.financeDebtorLink}>
                        <span>{debtor.clientName}</span>
                        <span className={styles.financeDebtorMeta}>
                          {formatEuroFromCents(debtor.balanceCents, locale)} ·{" "}
                          {tFinanceStatus(debtor.paymentStatus)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.summaryBody}>{t("finance.emptyDebtors")}</p>
            )}
          </section>
        ) : null}

        <section
          className={`${styles.fadeInUp}`}
          style={{ animationDelay: "240ms" }}
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
          {activityItems.length > 0 ? (
            <>
              <ul className={styles.activityList}>
                {activityItems.map((item) => (
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
              {activityNextCursor ? (
                <div className={styles.activityFooter}>
                  <button
                    type="button"
                    className={styles.activityLoadMore}
                    onClick={() => void onLoadMoreActivity()}
                    disabled={activityLoadingMore || loading}
                  >
                    {activityLoadingMore
                      ? t("daily.activity.loadingMore")
                      : t("daily.activity.loadMore", {
                          shown: activityItems.length,
                          total: activityTotal,
                        })}
                  </button>
                </div>
              ) : null}
            </>
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
