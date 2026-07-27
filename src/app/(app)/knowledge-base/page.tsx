import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { KnowledgeBaseView } from "@/components/knowledge-base/KnowledgeBaseView";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function KnowledgeBasePage() {
  const t = await getTranslations("knowledgeBase");

  return (
    <AppShell sectionTitle={t("title")}>
      <SectionHeader title={t("title")} />
      <KnowledgeBaseView />
    </AppShell>
  );
}
