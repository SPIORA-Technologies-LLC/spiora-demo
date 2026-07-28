import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { KnowledgeBaseView } from "@/components/knowledge-base/KnowledgeBaseView";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function ClientKnowledgeBasePage() {
  const t = await getTranslations("knowledgeBase");

  return (
    <AppShell sectionTitle={t("clientTitle")}>
      <SectionHeader title={t("clientTitle")} />
      <KnowledgeBaseView
        basePath="/client-knowledge-base"
        scope="client"
        rootLabel={t("clientTitle")}
      />
    </AppShell>
  );
}
