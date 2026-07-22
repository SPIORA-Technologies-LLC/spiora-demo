import { getClientSession } from "@/lib/client-portal/session";
import { validateClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

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

  return clientApiOk(result);
}
