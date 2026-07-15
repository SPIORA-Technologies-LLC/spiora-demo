import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { CheckupsView } from "@/components/checkups/CheckupsView";

export default async function CheckupsErevanPage() {
  const t = await getTranslations("checkupsPage");

  return (
    <AppShell sectionTitle={t("title")}>
      <CheckupsView />
    </AppShell>
  );
}
