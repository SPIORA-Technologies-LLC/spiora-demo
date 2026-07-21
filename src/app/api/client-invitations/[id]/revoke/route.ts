import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import { revokeClientInvitation } from "@/lib/client-portal/invitations";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);
  if (session.role !== "owner" && session.role !== "manager") {
    return clientApiError("FORBIDDEN", 403);
  }

  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host");
  const originCheck = checkRequestOrigin(originHeader, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return clientApiError("ORIGIN_MISMATCH", 403);
  }

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return clientApiError("NOT_FOUND", 404);
  }

  try {
    const result = await revokeClientInvitation(id);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return clientApiError("NOT_FOUND", 404);
      if (result.code === "ALREADY_ACCEPTED") {
        return clientApiError("ALREADY_ACCEPTED", 409);
      }
      return clientApiError("INTERNAL", 500);
    }
    return clientApiOk({ invitation: result.invitation });
  } catch {
    return clientApiError("INTERNAL", 500);
  }
}
