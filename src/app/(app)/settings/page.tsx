import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsView } from "@/components/settings/SettingsView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { branding } from "@/config/branding";
import { getSession } from "@/lib/auth/session";
import {
  getDemoCompanyWebsite,
  getIntegrationStatuses,
} from "@/lib/settings/integrations";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "owner") {
    redirect("/dashboard");
  }

  const t = await getTranslations("settings");

  return (
    <AppShell sectionTitle={t("title")}>
      <SectionHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsView
        user={session}
        demoMode={branding.demoMode}
        integrationStatuses={getIntegrationStatuses()}
        companyWebsite={getDemoCompanyWebsite()}
      />
    </AppShell>
  );
}
