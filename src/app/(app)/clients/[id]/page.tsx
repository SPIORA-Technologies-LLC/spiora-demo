import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ClientDetailView } from "@/components/clients/ClientDetailView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getClientDetail } from "@/lib/google-sheets/service";

type ClientPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;
  const detail = await getClientDetail(decodeURIComponent(id));
  const t = await getTranslations("clients.detail");

  if (!detail) {
    notFound();
  }

  return (
    <AppShell sectionTitle={t("sectionTitle", { name: detail.client.name })}>
      <SectionHeader
        title={detail.client.name}
        subtitle={t("subtitle")}
      />
      <ClientDetailView detail={detail} />
    </AppShell>
  );
}
