import { AppShell } from "@/components/layout/AppShell";
import { CommandCenterDashboard } from "@/components/dashboard/CommandCenterDashboard";
import { getCompanyHealthMetrics } from "@/lib/dashboard/company-health";
import {
  getCommandCenterDailyBriefing,
  resolveCommandCenterDayKey,
} from "@/lib/dashboard/daily-briefing";
import { getSession } from "@/lib/auth/session";
import {
  getActivityDayKey,
  getActivityRetentionCutoff,
} from "@/lib/presence/daily-activity-logic";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

type DashboardPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { date } = await searchParams;
  const dayKey = resolveCommandCenterDayKey(date ?? null);
  const t = await getTranslations("commandCenter");
  const [health, briefing] = await Promise.all([
    getCompanyHealthMetrics(session),
    getCommandCenterDailyBriefing(session, { dayKey }),
  ]);

  return (
    <AppShell sectionTitle={t("pageTitle")}>
      <CommandCenterDashboard
        user={session}
        health={health}
        initialBriefing={briefing}
        minDayKey={getActivityRetentionCutoff()}
        maxDayKey={getActivityDayKey()}
      />
    </AppShell>
  );
}
