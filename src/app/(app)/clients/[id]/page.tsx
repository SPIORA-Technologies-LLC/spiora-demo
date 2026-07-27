import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientDetailView } from "@/components/clients/ClientDetailView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getClientDetail } from "@/lib/google-sheets/service";
import { getSession } from "@/lib/auth/session";
import { canViewFinance } from "@/lib/finance/permissions";

type ClientPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function ClientPage({ params, searchParams }: ClientPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const detail = await getClientDetail(decodeURIComponent(id));
  const t = await getTranslations("clients.detail");
  const session = await getSession();

  if (!detail) {
    notFound();
  }

  const hasFinanceAccess = canViewFinance(session);

  return (
    <AppShell sectionTitle={t("sectionTitle", { name: detail.client.name })}>
      <SectionHeader
        title={detail.client.name}
        subtitle={t("subtitle")}
      />
      <ClientDetailView
        detail={detail}
        canViewFinance={hasFinanceAccess}
        initialTab={tab === "finance" && hasFinanceAccess ? "finance" : "overview"}
      />
    </AppShell>
  );
}
