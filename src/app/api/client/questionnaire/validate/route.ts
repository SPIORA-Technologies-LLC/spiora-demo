import { getClientSession } from "@/lib/client-portal/session";
import { validateClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { buildValidationFailurePayload } from "@/lib/client-portal/questionnaire-validation-payload";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const result = await validateClientQuestionnaire(
    {
      portalUserId: session.id,
      invitationId: session.invitationId,
      portalEmail: session.email,
      templateKey: null,
    },
    session.preferredLocale,
  );

  if (result.valid) {
    return clientApiOk({
      valid: true,
      errors: [],
      invalidFields: [] as string[],
      invalidFieldDetails: [] as Array<{
        field: string;
        section: string;
        reason: string;
        label?: string;
      }>,
    });
  }

  const payload = buildValidationFailurePayload(result.errors);
  return clientApiOk({
    valid: false,
    errors: payload.errors,
    invalidFields: payload.invalidFields,
    invalidFieldDetails: payload.invalidFieldDetails,
  });
}
