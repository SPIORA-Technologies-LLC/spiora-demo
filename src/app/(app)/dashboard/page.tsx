import { AppShell } from "@/components/layout/AppShell";
import { FirstImpressionView } from "@/components/dashboard/FirstImpressionView";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("commandCenter");

  return (
    <AppShell sectionTitle={t("pageTitle")}>
      <FirstImpressionView user={session} />
    </AppShell>
  );
}
