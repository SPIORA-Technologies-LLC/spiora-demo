import { AppShell } from "@/components/layout/AppShell";
import styles from "@/components/layout/AppShell.module.css";
import { AiWorkspaceView } from "@/components/ai-workspace/AiWorkspaceView";
import { getTranslations } from "next-intl/server";

export default async function AiWorkspacePage() {
  const t = await getTranslations("aiWorkspace");

  return (
    <AppShell
      sectionTitle={t("pageTitle")}
      contentClassName={styles.contentFullHeight}
    >
      <AiWorkspaceView />
    </AppShell>
  );
}
