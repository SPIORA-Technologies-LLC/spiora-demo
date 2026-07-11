import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { getSession } from "@/lib/auth/session";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") redirect("/dashboard");

  const t = await getTranslations("analytics");

  return (
    <AppShell sectionTitle={t("title")}>
      <AnalyticsView />
    </AppShell>
  );
}
