import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { KnowledgeBaseEditorView } from "@/components/knowledge-base/KnowledgeBaseEditorView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getSession } from "@/lib/auth/session";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";

export default async function EditKnowledgeBaseArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner" || !isKnowledgeBasePostgresEnabled()) {
    redirect("/knowledge-base");
  }

  const { slug } = await params;
  const t = await getTranslations("knowledgeBase");

  return (
    <AppShell sectionTitle={t("title")}>
      <SectionHeader title={t("editor.editTitle")} subtitle={slug} />
      <KnowledgeBaseEditorView mode="edit" slug={slug} />
    </AppShell>
  );
}
