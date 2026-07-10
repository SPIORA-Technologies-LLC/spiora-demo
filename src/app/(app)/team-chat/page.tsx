import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import styles from "@/components/layout/AppShell.module.css";
import { TeamChatView } from "@/components/team-chat/TeamChatView";
import { getSession } from "@/lib/auth/session";
import {
  listPinnedTeamChatMessages,
  listTeamChatMessages,
  markTeamChatSeen,
} from "@/lib/team-chat/store";

export default async function TeamChatPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("teamChat");

  await markTeamChatSeen(session.id);

  const initial = await listTeamChatMessages({ limit: 100 });
  const pinned = await listPinnedTeamChatMessages();

  return (
    <AppShell
      sectionTitle={t("pageTitle")}
      contentClassName={styles.contentFullHeight}
    >
      <TeamChatView
        user={session}
        initialMessages={initial.messages}
        initialLatestCreatedAt={initial.latestCreatedAt}
        initialHasMoreBefore={initial.hasMoreBefore}
        initialPinnedMessages={pinned}
      />
    </AppShell>
  );
}
