import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientInvitationsPanel } from "@/components/client-portal/ClientInvitationsPanel";

export default async function ClientInvitationsPage() {
  const t = await getTranslations("clientInvitations");

  return (
    <AppShell sectionTitle={t("title")}>
      <ClientInvitationsPanel />
    </AppShell>
  );
}
