import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { branding } from "@/config/branding";
import type { DashboardStats } from "@/lib/dashboard/stats";
import type { SessionUser } from "@/lib/auth/types";
import type { TaskStats } from "@/lib/tasks/types";
import type { TeamChatMessage } from "@/lib/team-chat/types";
import { DashboardTeamMessages } from "@/components/dashboard/DashboardTeamMessages";
import { TeamOnlineBar } from "@/components/presence/TeamOnlineBar";
import { Card } from "@/components/ui/Card";
import styles from "./DashboardView.module.css";

type StatItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
  icon: string;
  href?: string;
  overdueHighlight?: boolean;
};

type QuickAction = {
  id: string;
  label: string;
  href: string;
  icon: string;
  external?: boolean;
};

type DashboardViewProps = {
  user: SessionUser;
  taskStats: TaskStats;
  teamRecentMessages: TeamChatMessage[];
  dashboardStats: DashboardStats;
};

export async function DashboardView({
  user,
  taskStats,
  teamRecentMessages,
  dashboardStats,
}: DashboardViewProps) {
  const t = await getTranslations("dashboard");

  const quickActions: QuickAction[] = [
    {
      id: "createTask",
      label: t("quickActions.createTask"),
      href: "/tasks/new",
      icon: "fa-solid fa-list-check",
    },
    {
      id: "openAiWorkspace",
      label: t("quickActions.openAiWorkspace"),
      href: "/ai-workspace",
      icon: "fa-solid fa-robot",
    },
  ];

  const platformStats: StatItem[] = [
    {
      id: "clients",
      label: t("platformStats.clients"),
      value: String(dashboardStats.clientsTotal),
      hint: t("platformStats.clientsHint"),
      icon: "fa-solid fa-users",
    },
    {
      id: "newForms",
      label: t("platformStats.newForms"),
      value: String(dashboardStats.newFormgridLeads7Days),
      hint: t("platformStats.newFormsHint"),
      icon: "fa-solid fa-clipboard-list",
    },
    {
      id: "consultations",
      label: t("platformStats.consultations"),
      value: String(dashboardStats.activeConsultations),
      hint: t("platformStats.consultationsHint"),
      icon: "fa-solid fa-calendar-check",
    },
    {
      id: "aiRequests",
      label: t("platformStats.aiRequests"),
      value: String(dashboardStats.aiRequestsThisMonth),
      hint: t("platformStats.aiRequestsHint"),
      icon: "fa-solid fa-wand-magic-sparkles",
    },
  ];

  const taskStatItems: StatItem[] = [
    {
      id: "total",
      label: t("taskStats.total"),
      value: String(taskStats.total),
      hint: t("taskStats.totalHint"),
      icon: "fa-solid fa-list-check",
      href: "/tasks",
    },
    {
      id: "inProgress",
      label: t("taskStats.inProgress"),
      value: String(taskStats.inProgress),
      hint: t("taskStats.inProgressHint"),
      icon: "fa-solid fa-spinner",
      href: "/tasks?status=in_progress",
    },
    {
      id: "completed",
      label: t("taskStats.completed"),
      value: String(taskStats.completed),
      hint: t("taskStats.completedHint"),
      icon: "fa-solid fa-circle-check",
      href: "/tasks?status=completed",
    },
    {
      id: "overdue",
      label: t("taskStats.overdue"),
      value: String(taskStats.overdue),
      hint:
        taskStats.overdue > 0
          ? t("taskStats.overdueHintClick")
          : t("taskStats.overdueHintNone"),
      icon: "fa-solid fa-clock",
      href: taskStats.overdue > 0 ? "/tasks?overdue=1" : "/tasks",
      overdueHighlight: taskStats.overdue > 0,
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="dashboard-hero-title">
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.heroEyebrow}>
            {t("hero.welcome", { name: user.name })}
          </p>
          <h1 id="dashboard-hero-title" className={styles.heroTitle}>
            {t("hero.workspace", { product: branding.productName })}
          </h1>
          <p className={styles.heroSubtitle}>{t("hero.subtitle")}</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="tasks-heading">
        <div className={styles.sectionHeadingRow}>
          <h2 id="tasks-heading" className={styles.sectionTitle}>
            📋 {t("sections.tasks")}
          </h2>
          <Link href="/tasks" className={styles.sectionLink}>
            {t("sections.allTasks")}
            <i className="fa-solid fa-arrow-right" aria-hidden />
          </Link>
        </div>
        <div className={styles.statsGridWrap}>
          <ul className={styles.statsGrid}>
            {taskStatItems.map((stat) => {
              const card = (
                <Card
                  className={[
                    styles.statCard,
                    stat.href ? styles.statCardClickable : "",
                    stat.overdueHighlight ? styles.statCardOverdue : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className={styles.statIconWrap} aria-hidden>
                    <i className={stat.icon} />
                  </div>
                  <div className={styles.statBody}>
                    <span className={styles.statValue}>{stat.value}</span>
                    <span className={styles.statLabel}>{stat.label}</span>
                    <span className={styles.statHint}>{stat.hint}</span>
                  </div>
                </Card>
              );

              return (
                <li key={stat.id}>
                  {stat.href ? (
                    <Link href={stat.href} className={styles.statLink}>
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        className={[styles.section, styles.teamChatSection].join(" ")}
        aria-labelledby="team-chat-heading"
      >
        <div className={styles.sectionHeadingRow}>
          <h2 id="team-chat-heading" className={styles.sectionTitle}>
            {t("sections.teamMessages")}
          </h2>
          <Link href="/team-chat" className={styles.sectionLink}>
            {t("sections.openChat")}
            <i className="fa-solid fa-arrow-right" aria-hidden />
          </Link>
        </div>

        <TeamOnlineBar variant="prominent" />
        <h3 className={styles.subsectionTitle}>
          {t("sections.recentMessages")}
        </h3>
        <DashboardTeamMessages messages={teamRecentMessages} />
      </section>

      <section className={styles.section} aria-labelledby="stats-heading">
        <h2 id="stats-heading" className={styles.sectionTitle}>
          {t("sections.stats")}
        </h2>
        <div className={styles.statsGridWrap}>
          <ul className={styles.statsGrid}>
            {platformStats.map((stat) => (
              <li key={stat.id}>
                <Card className={styles.statCard}>
                  <div className={styles.statIconWrap} aria-hidden>
                    <i className={stat.icon} />
                  </div>
                  <div className={styles.statBody}>
                    <span className={styles.statValue}>{stat.value}</span>
                    <span className={styles.statLabel}>{stat.label}</span>
                    <span className={styles.statHint}>{stat.hint}</span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="actions-heading">
        <h2 id="actions-heading" className={styles.sectionTitle}>
          {t("sections.quickActions")}
        </h2>
        <ul className={styles.actionsGrid}>
          {quickActions.map((action) => {
            const card = (
              <Card className={styles.actionCard}>
                <span className={styles.actionIconWrap} aria-hidden>
                  <i className={action.icon} />
                </span>
                <span className={styles.actionLabel}>{action.label}</span>
                <i
                  className={`fa-solid ${
                    action.external ? "fa-arrow-up-right-from-square" : "fa-arrow-right"
                  } ${styles.actionArrow}`}
                  aria-hidden
                />
              </Card>
            );

            return (
              <li key={action.id}>
                {action.external ? (
                  <a
                    href={action.href}
                    className={styles.actionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {card}
                  </a>
                ) : (
                  <Link href={action.href} className={styles.actionLink}>
                    {card}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
