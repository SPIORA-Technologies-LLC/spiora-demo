import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/lib/auth/types";
import type { CompanyHealthMetrics } from "@/lib/dashboard/company-health";
import {
  AI_INSIGHTS,
  PRIORITY_CARDS,
  TEAM_ACTIVITY,
} from "@/lib/dashboard/first-impression-seed";
import { AskSpioraPanel } from "./AskSpioraPanel";
import styles from "./FirstImpressionView.module.css";

type FirstImpressionViewProps = {
  user: SessionUser;
  health: CompanyHealthMetrics;
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

export async function FirstImpressionView({ user, health }: FirstImpressionViewProps) {
  const t = await getTranslations("commandCenter");
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;

  return (
    <div className={styles.page}>
      <header className={`${styles.hero} ${styles.fadeInUp}`}>
        <div className={styles.heroGlow} aria-hidden />
        <p className={styles.greeting}>
          {t("greeting", { name: firstName })}
        </p>
        <h1 className={styles.calmHeadline}>{t("calmHeadline")}</h1>
        <p className={styles.heroLead}>{t("heroLead")}</p>
      </header>

      <section
        className={`${styles.panel} ${styles.executiveSummary} ${styles.fadeInUp}`}
        style={{ animationDelay: "80ms" }}
        aria-labelledby="executive-summary-title"
      >
        <h2 id="executive-summary-title" className={styles.panelTitle}>
          {t("executiveSummary.title")}
        </h2>
        <div className={styles.summaryBody}>
          <p>{t("executiveSummary.line1")}</p>
          <p>{t("executiveSummary.line2")}</p>
          <p>{t("executiveSummary.line3")}</p>
          <p className={styles.summaryAccent}>{t("executiveSummary.line4")}</p>
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
          {PRIORITY_CARDS.map((card) => (
            <li key={card.id}>
              <article
                className={[styles.priorityCard, toneClass(card.tone)].join(
                  " ",
                )}
              >
                <span className={styles.priorityIcon} aria-hidden>
                  {toneIcon(card.tone)}
                </span>
                <p className={styles.priorityText}>{t(card.textKey)}</p>
              </article>
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
          {t("insights.title")}
        </h2>
        <ul className={styles.insightsList}>
          {AI_INSIGHTS.map((insight) => (
            <li key={insight.id}>
              {insight.href ? (
                <Link href={insight.href} className={styles.insightLink}>
                  {t(insight.textKey)}
                </Link>
              ) : (
                <span>{t(insight.textKey)}</span>
              )}
            </li>
          ))}
        </ul>
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
            <dd>{health.clients.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>{t("companyHealth.documents")}</dt>
            <dd>{health.documents.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>{t("companyHealth.meetings")}</dt>
            <dd>{health.meetings}</dd>
          </div>
          <div>
            <dt>{t("companyHealth.tasksCompleted")}</dt>
            <dd>{health.tasksCompletedPercent}%</dd>
          </div>
          <div>
            <dt>{t("companyHealth.aiConversations")}</dt>
            <dd>{health.aiConversations}</dd>
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
        <ul className={styles.activityList}>
          {TEAM_ACTIVITY.map((item) => (
            <li key={item.id} className={styles.activityItem}>
              <span className={styles.activityDot} aria-hidden />
              <span>{t(item.textKey)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
