import { getClientSession } from "@/lib/client-portal/session";
import {
  getClientQuestionnaire,
  saveClientQuestionnaireDraft,
} from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const result = await getClientQuestionnaire({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });

  if (!result.ok) {
    const status =
      result.code === "QUESTIONNAIRE_NOT_AVAILABLE"
        ? 404
        : result.code === "QUESTIONNAIRE_SCHEMA_INVALID"
          ? 503
          : 500;
    return clientApiError(
      result.code as
        | "QUESTIONNAIRE_NOT_AVAILABLE"
        | "QUESTIONNAIRE_SCHEMA_INVALID"
        | "INTERNAL",
      status,
    );
  }

  return clientApiOk(result.data);
}

export async function PATCH(request: Request) {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return clientApiError("INVALID_BODY", 400);
  }

  const baseRevision =
    typeof body.baseRevision === "number" ? body.baseRevision : null;
  const operations = Array.isArray(body.operations) ? body.operations : null;

  if (!operations) return clientApiError("INVALID_BODY", 400);

  const result = await saveClientQuestionnaireDraft(
    {
      portalUserId: session.id,
      invitationId: session.invitationId,
      portalEmail: session.email,
      templateKey: null,
    },
    {
      baseRevision,
      operations: operations as Array<
        | { op: "set"; questionId: string; value: unknown }
        | { op: "clear"; questionId: string }
      >,
      locale: session.preferredLocale,
    },
  );

  if (!result.ok) {
    const status =
      result.code === "QUESTIONNAIRE_REVISION_CONFLICT"
        ? 409
        : result.code === "QUESTIONNAIRE_NOT_AVAILABLE"
          ? 404
          : result.code === "QUESTIONNAIRE_SCHEMA_INVALID"
            ? 503
            : 400;
    return clientApiError(
      result.code as
        | "QUESTIONNAIRE_NOT_AVAILABLE"
        | "QUESTIONNAIRE_SCHEMA_INVALID"
        | "QUESTIONNAIRE_READ_ONLY"
        | "QUESTIONNAIRE_REVISION_CONFLICT"
        | "QUESTIONNAIRE_VALUE_INVALID"
        | "QUESTIONNAIRE_PAYLOAD_TOO_LARGE",
      status,
    );
  }

  return clientApiOk({
    questionnaireId: result.questionnaireId,
    revision: result.revision,
    answers: result.answers,
    lastSavedAt: result.lastSavedAt,
    created: result.created,
  });
}
