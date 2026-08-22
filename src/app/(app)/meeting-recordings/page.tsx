import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { MeetingRecordingsView } from "@/components/meeting-recordings/MeetingRecordingsView";
import { getSession } from "@/lib/auth/session";

export default async function MeetingRecordingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("meetingRecordings");

  return (
    <AppShell sectionTitle={t("title")}>
      <MeetingRecordingsView />
    </AppShell>
  );
}
