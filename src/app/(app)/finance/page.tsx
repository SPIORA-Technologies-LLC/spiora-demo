import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { getSession } from "@/lib/auth/session";
import { canViewFinance } from "@/lib/finance/permissions";

export default async function FinancePage() {
  const session = await getSession();
  if (!session || !canViewFinance(session)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("finance");

  return (
    <AppShell sectionTitle={t("title")}>
      <FinanceDashboard />
    </AppShell>
  );
}
