import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientsList } from "@/components/clients/ClientsList";
import { ClientInvitationsPanel } from "@/components/client-portal/ClientInvitationsPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function ClientsPage() {
  const t = await getTranslations("clients");

  return (
    <AppShell sectionTitle={t("title")}>
      <SectionHeader title={t("title")} subtitle={t("subtitle")} />
      <ClientInvitationsPanel />
      <ClientsList />
    </AppShell>
  );
}
