import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ClientsList } from "@/components/clients/ClientsList";
import { ClientInvitationsPanel } from "@/components/client-portal/ClientInvitationsPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function ClientsPage() {
  const t = await getTranslations("clients");
  const tIntake = await getTranslations("clientIntake");

  return (
    <AppShell sectionTitle={t("title")}>
      <SectionHeader title={t("title")} subtitle={t("subtitle")} />
      <p>
        <Link href="/clients/intake">{tIntake("title")} →</Link>
      </p>
      <ClientInvitationsPanel />
      <ClientsList />
    </AppShell>
  );
}
