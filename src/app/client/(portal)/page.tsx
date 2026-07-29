import { getTranslations } from "next-intl/server";
import { ClientPortalAssistant } from "@/components/client-portal/ClientPortalAssistant";
import { ClientPortalHome } from "@/components/client-portal/ClientPortalHome";
import { getClientSession } from "@/lib/client-portal/session";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { getPortalCaseForUser } from "@/lib/client-portal/case-service";
import { resolveClientFirstName } from "@/lib/client-portal/display-name";
import { redirect } from "next/navigation";

export default async function ClientHomePage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const t = await getTranslations("clientPortal");
  const [questionnaire, caseData] = await Promise.all([
    getClientQuestionnaire({
      portalUserId: session.id,
      invitationId: session.invitationId,
      portalEmail: session.email,
      templateKey: null,
    }),
    getPortalCaseForUser(session.id),
  ]);
  const questionnaireStatus = questionnaire.ok
    ? t(`questionnaire.status.${questionnaire.data.questionnaire.status}` as never)
    : t("questionnaire.status.unavailable");
  const questionnaireProgress = questionnaire.ok
    ? t("questionnaire.progressSummary", {
        percent: questionnaire.data.progress.percent,
      })
    : t("questionnaire.progressSummary", { percent: 0 });
  const questionnaireUnavailable = !questionnaire.ok;
  const questionnaireSubmitted =
    Boolean(caseData) ||
    (questionnaire.ok &&
      (questionnaire.data.questionnaire.status === "submitted" ||
        questionnaire.data.questionnaire.status === "locked"));

  const firstName = resolveClientFirstName({
    authFirstName: session.firstName,
    questionnaireFirstName: questionnaire.ok
      ? questionnaire.data.questionnaire.answers.first_name
      : null,
  });
  const title = firstName
    ? t("home.titleNamed", { name: firstName })
    : t("home.title");

  return (
    <ClientPortalHome
      email={session.email}
      title={title}
      brand={t("brand")}
      statusLabel={
        questionnaireSubmitted
          ? t("home.applicationReceived")
          : t("home.inviteAccepted")
      }
      questionnaireStatus={questionnaireStatus}
      questionnaireProgress={questionnaireProgress}
      questionnaireUnavailable={questionnaireUnavailable}
      questionnaireSubmitted={questionnaireSubmitted}
      initialCase={caseData}
      placeholders={{
        questionnaire: t("placeholders.questionnaire"),
        documents: t("placeholders.documents"),
        status: questionnaireSubmitted
          ? t("home.applicationReceived")
          : t("placeholders.status"),
      }}
      logoutLabel={t("logout")}
      assistantSlot={<ClientPortalAssistant />}
    />
  );
}
