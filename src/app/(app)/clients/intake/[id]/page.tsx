import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientCaseDetail } from "@/components/clients/ClientCaseDetail";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getSession } from "@/lib/auth/session";
import { canViewFinance } from "@/lib/finance/permissions";

type Props = { params: Promise<{ id: string }> };

export default async function ClientCasePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("clientIntake.detail");
  const session = await getSession();

  return (
    <AppShell sectionTitle={t("sectionTitle")}>
      <SectionHeader title={t("sectionTitle")} subtitle={t("subtitle")} />
      <ClientCaseDetail
        caseId={id}
        canViewFinance={canViewFinance(session)}
      />
    </AppShell>
  );
}
