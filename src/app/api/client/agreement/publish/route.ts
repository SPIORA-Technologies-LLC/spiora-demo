import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { publishClientAgreement } from "@/lib/client-portal/sign/service";
import { requireClient, signErrorResponse } from "@/lib/client-portal/sign/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireClient(request);
  if (!auth.ok) return auth.response;

  const current = await getClientQuestionnaire({
    portalUserId: auth.session.id,
    invitationId: auth.session.invitationId,
    portalEmail: auth.session.email,
    templateKey: null,
  });
  if (!current.ok || !current.data.questionnaire.id) {
    return clientApiError("QUESTIONNAIRE_NOT_AVAILABLE", 404);
  }

  try {
    const sign = await publishClientAgreement({
      session: auth.session,
      questionnaireId: current.data.questionnaire.id,
      answers: current.data.questionnaire.answers,
      locale: auth.session.preferredLocale === "ru" ? "ru" : "en",
      meta: auth.meta,
    });
    return clientApiOk({ sign });
  } catch (error) {
    return signErrorResponse(error);
  }
}
