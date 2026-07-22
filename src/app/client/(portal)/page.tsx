import { getTranslations } from "next-intl/server";
import { ClientPortalHome } from "@/components/client-portal/ClientPortalHome";
import { getClientSession } from "@/lib/client-portal/session";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { redirect } from "next/navigation";

export default async function ClientHomePage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const t = await getTranslations("clientPortal");
  const questionnaire = await getClientQuestionnaire({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });
  const questionnaireStatus = questionnaire.ok
    ? t(`questionnaire.status.${questionnaire.data.questionnaire.status}` as never)
    : t("questionnaire.status.unavailable");
  const questionnaireProgress = questionnaire.ok
    ? t("questionnaire.progressSummary", {
        percent: questionnaire.data.progress.percent,
      })
    : t("questionnaire.progressSummary", { percent: 0 });
  const questionnaireUnavailable = !questionnaire.ok;

  return (
    <ClientPortalHome
      email={session.email}
      title={t("home.title")}
      brand={t("brand")}
      statusLabel={t("home.inviteAccepted")}
      questionnaireStatus={questionnaireStatus}
      questionnaireProgress={questionnaireProgress}
      questionnaireUnavailable={questionnaireUnavailable}
      placeholders={{
        questionnaire: t("placeholders.questionnaire"),
        documents: t("placeholders.documents"),
        status: t("placeholders.status"),
      }}
      logoutLabel={t("logout")}
    />
  );
}
