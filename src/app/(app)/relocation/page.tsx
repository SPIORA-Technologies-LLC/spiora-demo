import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { RelocationView } from "@/components/relocation/RelocationView";

export default async function RelocationPage() {
  const t = await getTranslations("relocationPage");

  return (
    <AppShell sectionTitle={t("title")}>
      <RelocationView />
    </AppShell>
  );
}
