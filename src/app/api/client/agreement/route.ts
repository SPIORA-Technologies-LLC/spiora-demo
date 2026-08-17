import { getClientSession } from "@/lib/client-portal/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import {
  getAgreementByPortalUser,
  viewFromRecord,
} from "@/lib/client-portal/consulting-agreement-service";
import {
  buildClientAgreementPayload,
  viewWithSign,
} from "@/lib/client-portal/sign/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const current = await getClientQuestionnaire({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });
  const answers = current.ok ? current.data.questionnaire.answers : {};
  const submittedAt = current.ok ? current.data.questionnaire.submittedAt : null;
  const lastSavedAt = current.ok ? current.data.questionnaire.lastSavedAt : null;

  try {
    const signed = await buildClientAgreementPayload({
      session,
      answers,
      submittedAt,
      lastSavedAt,
    });
    if (signed.sign) {
      return clientApiOk({ agreement: signed });
    }
  } catch {
    // Fall through to legacy snapshot.
  }

  const saved = await getAgreementByPortalUser(session.id);
  if (saved) {
    return clientApiOk({ agreement: viewWithSign(viewFromRecord(saved), null) });
  }

  if (!current.ok) {
    return clientApiError("QUESTIONNAIRE_NOT_AVAILABLE", 404);
  }

  return clientApiOk({
    agreement: await buildClientAgreementPayload({
      session,
      answers,
      submittedAt,
      lastSavedAt,
    }),
  });
}
