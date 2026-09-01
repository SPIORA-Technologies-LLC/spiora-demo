import { AppShell } from "@/components/layout/AppShell";
import { FirstImpressionView } from "@/components/dashboard/FirstImpressionView";
import { getCompanyHealthMetrics } from "@/lib/dashboard/company-health";
import { getCommandCenterDailyBriefing } from "@/lib/dashboard/daily-briefing";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("commandCenter");
  const [health, briefing] = await Promise.all([
    getCompanyHealthMetrics(session),
    getCommandCenterDailyBriefing(session),
  ]);

  return (
    <AppShell sectionTitle={t("pageTitle")}>
      <FirstImpressionView user={session} health={health} briefing={briefing} />
    </AppShell>
  );
}
