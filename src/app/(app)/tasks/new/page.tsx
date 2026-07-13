import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { NewTaskPageView } from "@/components/tasks/NewTaskPageView";
import { getSession } from "@/lib/auth/session";
import { listTeamMembers } from "@/lib/team/store";
import { redirect } from "next/navigation";

export default async function NewTaskPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("tasks");
  const teamMembers = (await listTeamMembers()).map((member) => ({
    id: member.id,
    name: member.name,
  }));

  return (
    <AppShell sectionTitle={t("title")}>
      <NewTaskPageView teamMembers={teamMembers} />
    </AppShell>
  );
}
