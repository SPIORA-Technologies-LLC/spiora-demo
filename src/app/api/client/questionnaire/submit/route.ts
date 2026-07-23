import { getClientSession } from "@/lib/client-portal/session";
import { submitClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import {
  buildValidationFailurePayload,
  logQuestionnaireValidationFailure,
} from "@/lib/client-portal/questionnaire-validation-payload";
import type { ValidationErrorItem } from "@/lib/client-portal/questionnaire-types";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const result = await submitClientQuestionnaire(
    {
      portalUserId: session.id,
      invitationId: session.invitationId,
      portalEmail: session.email,
      templateKey: null,
    },
    session.preferredLocale,
  );

  if (!result.ok) {
    const status =
      result.code === "QUESTIONNAIRE_NOT_AVAILABLE"
        ? 404
        : result.code === "QUESTIONNAIRE_ACCESS_DENIED"
          ? 403
          : 400;

    if (result.code === "QUESTIONNAIRE_VALIDATION_FAILED") {
      const errors =
        "errors" in result
          ? ((result.errors ?? []) as ValidationErrorItem[])
          : [];
      logQuestionnaireValidationFailure(errors);
      const payload = buildValidationFailurePayload(errors);
      return Response.json(
        {
          error: {
            code: payload.code,
            message: payload.message,
          },
          invalidFields: payload.invalidFields,
          invalidFieldDetails: payload.invalidFieldDetails,
          errors: payload.errors,
        },
        {
          status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return Response.json(
      {
        error: {
          code: result.code,
          message: undefined,
        },
        errors: "errors" in result ? (result.errors ?? []) : [],
      },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return clientApiOk({
    status: result.record.status,
    revision: result.record.revision,
    submittedAt: result.submittedAt,
    alreadySubmitted: result.alreadySubmitted,
    caseId: result.caseId,
    caseCreated: result.caseCreated,
    caseStatus: result.caseStatus,
  });
}
