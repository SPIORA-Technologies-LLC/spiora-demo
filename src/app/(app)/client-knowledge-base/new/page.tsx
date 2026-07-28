import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { KnowledgeBaseEditorView } from "@/components/knowledge-base/KnowledgeBaseEditorView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getSession } from "@/lib/auth/session";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";

export default async function NewClientKnowledgeBaseArticlePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner" || !isKnowledgeBasePostgresEnabled()) {
    redirect("/client-knowledge-base");
  }

  const t = await getTranslations("knowledgeBase");

  return (
    <AppShell sectionTitle={t("clientTitle")}>
      <SectionHeader title={t("editor.newTitle")} subtitle={t("clientTitle")} />
      <KnowledgeBaseEditorView
        mode="create"
        basePath="/client-knowledge-base"
        scope="client"
      />
    </AppShell>
  );
}
