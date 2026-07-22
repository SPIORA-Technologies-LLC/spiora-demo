import { getClientSession } from "@/lib/client-portal/session";
import { reopenClientQuestionnaireDraft } from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const result = await reopenClientQuestionnaireDraft({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });

  if (!result.ok) {
    return clientApiError(
      result.code as
        | "QUESTIONNAIRE_NOT_AVAILABLE"
        | "QUESTIONNAIRE_NOT_IN_REVIEW"
        | "QUESTIONNAIRE_REVISION_CONFLICT",
      result.code === "QUESTIONNAIRE_NOT_AVAILABLE" ? 404 : 400,
    );
  }

  return clientApiOk({
    status: result.record.status,
    revision: result.record.revision,
  });
}
