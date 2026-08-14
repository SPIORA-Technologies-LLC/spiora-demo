import { getClientSession } from "@/lib/client-portal/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import {
  buildConsultingAgreementPreview,
} from "@/lib/client-portal/consulting-agreement-fields";
import {
  getAgreementByPortalUser,
  viewFromRecord,
} from "@/lib/client-portal/consulting-agreement-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const locale = session.preferredLocale === "ru" ? "ru" : "en";
  const saved = await getAgreementByPortalUser(session.id);
  if (saved) {
    return clientApiOk({ agreement: viewFromRecord(saved) });
  }

  const current = await getClientQuestionnaire({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });
  if (!current.ok) {
    return clientApiError("QUESTIONNAIRE_NOT_AVAILABLE", 404);
  }

  const agreement = buildConsultingAgreementPreview(
    current.data.questionnaire.answers,
    locale,
    {
      submittedAt: current.data.questionnaire.submittedAt,
      clientAcceptedAt:
        current.data.questionnaire.answers.consulting_agreement_acknowledgement ===
        true
          ? current.data.questionnaire.lastSavedAt
          : null,
    },
  );

  return clientApiOk({ agreement });
}
