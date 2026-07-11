import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { TeamView } from "@/components/team/TeamView";
import { getSession } from "@/lib/auth/session";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("team");

  return (
    <AppShell sectionTitle={t("title")}>
      <TeamView user={session} />
    </AppShell>
  );
}
