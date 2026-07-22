import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientIntakeList } from "@/components/clients/ClientIntakeList";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function ClientIntakePage() {
  const t = await getTranslations("clientIntake");

  return (
    <AppShell sectionTitle={t("title")}>
      <SectionHeader title={t("title")} subtitle={t("subtitle")} />
      <ClientIntakeList />
    </AppShell>
  );
}
