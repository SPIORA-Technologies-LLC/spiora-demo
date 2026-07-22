import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientCaseDetail } from "@/components/clients/ClientCaseDetail";
import { SectionHeader } from "@/components/ui/SectionHeader";

type Props = { params: Promise<{ id: string }> };

export default async function ClientCasePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("clientIntake.detail");

  return (
    <AppShell sectionTitle={t("sectionTitle")}>
      <SectionHeader title={t("sectionTitle")} subtitle={t("subtitle")} />
      <ClientCaseDetail caseId={id} />
    </AppShell>
  );
}
