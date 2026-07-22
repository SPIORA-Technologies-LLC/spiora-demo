import { getClientSession } from "@/lib/client-portal/session";
import { moveClientQuestionnaireToReview } from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const result = await moveClientQuestionnaireToReview(
    {
      portalUserId: session.id,
      invitationId: session.invitationId,
      portalEmail: session.email,
      templateKey: null,
    },
    session.preferredLocale,
  );

  if (!result.ok) {
    return Response.json(
      {
        error: {
          code: result.code,
          message:
            result.code === "QUESTIONNAIRE_VALIDATION_FAILED"
              ? "Questionnaire validation failed"
              : undefined,
        },
        errors: result.errors ?? [],
      },
      {
        status: result.code === "QUESTIONNAIRE_NOT_AVAILABLE" ? 404 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return clientApiOk({
    status: result.record.status,
    revision: result.record.revision,
    reviewedAt: result.record.reviewedAt,
  });
}
