import { getTranslations } from "next-intl/server";
import { ClientPortalAssistant } from "@/components/client-portal/ClientPortalAssistant";
import { ClientPortalHome } from "@/components/client-portal/ClientPortalHome";
import { getClientSession } from "@/lib/client-portal/session";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { getPortalCaseForUser } from "@/lib/client-portal/case-service";
import { resolveClientFirstName } from "@/lib/client-portal/display-name";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ enter?: string }>;
};

export default async function ClientHomePage({ searchParams }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const params = await searchParams;
  const showEntrySplash = params.enter === "1";
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
      questionnaireStatus={questionnaireStatus}
      questionnaireProgress={questionnaireProgress}
      questionnaireUnavailable={questionnaireUnavailable}
      questionnaireSubmitted={questionnaireSubmitted}
      initialCase={caseData}
      logoutLabel={t("logout")}
      showEntrySplash={showEntrySplash}
      assistantSlot={<ClientPortalAssistant />}
    />
  );
}
