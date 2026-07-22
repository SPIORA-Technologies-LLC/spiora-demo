import { getClientSession } from "@/lib/client-portal/session";
import { getPortalCaseForUser } from "@/lib/client-portal/case-service";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const caseData = await getPortalCaseForUser(session.id);
  if (!caseData) {
    return clientApiOk({ case: null });
  }

  return clientApiOk({ case: caseData });
}
