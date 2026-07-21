import { getSession } from "@/lib/auth/session";
import { listClientInvitationAssignees } from "@/lib/client-portal/assignees";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);
  if (session.role !== "owner" && session.role !== "manager") {
    return clientApiError("FORBIDDEN", 403);
  }

  try {
    const assignees = await listClientInvitationAssignees();
    return clientApiOk({ assignees });
  } catch {
    return clientApiError("INTERNAL", 500);
  }
}
