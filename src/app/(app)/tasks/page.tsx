import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { TasksView } from "@/components/tasks/TasksView";
import { listTeamMembers } from "@/lib/team/store";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("tasks");
  const teamMembers = (await listTeamMembers()).map((u) => ({
    id: u.id,
    name: u.name,
  }));

  return (
    <AppShell sectionTitle={t("title")}>
      <Suspense fallback={<p>{t("loading.list")}</p>}>
        <TasksView user={session} teamMembers={teamMembers} />
      </Suspense>
    </AppShell>
  );
}
