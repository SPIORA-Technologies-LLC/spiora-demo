import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { FinanceAnalyticsView } from "@/components/finance/FinanceAnalyticsView";
import { getSession } from "@/lib/auth/session";
import { canViewFinance } from "@/lib/finance/permissions";

export default async function FinanceAnalyticsPage() {
  const session = await getSession();
  if (!session || !canViewFinance(session)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("finance.analytics");

  return (
    <AppShell sectionTitle={t("title")}>
      <FinanceAnalyticsView />
    </AppShell>
  );
}
