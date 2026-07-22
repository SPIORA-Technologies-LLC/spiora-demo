import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/session";
import { getPortalCaseForUser } from "@/lib/client-portal/case-service";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { ClientQuestionnaireSubmittedPage } from "@/components/client-portal/ClientQuestionnaireSubmittedPage";

export default async function QuestionnaireSubmittedPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const [questionnaire, caseData] = await Promise.all([
    getClientQuestionnaire({
      portalUserId: session.id,
      invitationId: session.invitationId,
      portalEmail: session.email,
      templateKey: null,
    }),
    getPortalCaseForUser(session.id),
  ]);

  const status = questionnaire.ok ? questionnaire.data.questionnaire.status : null;
  if (status !== "submitted" && status !== "locked" && !caseData) {
    redirect("/client/questionnaire/review");
  }

  return (
    <ClientQuestionnaireSubmittedPage
      email={session.email}
      submittedAt={
        caseData?.submittedAt ??
        (questionnaire.ok ? questionnaire.data.questionnaire.submittedAt : null)
      }
      initialStatus={caseData?.currentStatus ?? "application_received"}
    />
  );
}
