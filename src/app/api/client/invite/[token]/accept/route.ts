import { checkRequestOrigin } from "@/lib/auth/security";
import {
  acceptInvitationByToken,
} from "@/lib/client-portal/invitations";
import { getClientAuthUser } from "@/lib/client-portal/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host");
  const originCheck = checkRequestOrigin(originHeader, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return clientApiError("ORIGIN_MISMATCH", 403);
  }

  const authUser = await getClientAuthUser();
  if (!authUser) {
    return clientApiError("AUTH_REQUIRED", 401);
  }

  const { token: raw } = await ctx.params;
  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    return clientApiError("INVITATION_INVALID", 404);
  }

  try {
    const result = await acceptInvitationByToken({
      token,
      authUserId: authUser.id,
      authEmail: authUser.email,
    });

    if (!result.ok) {
      const map: Record<
        string,
        { code: Parameters<typeof clientApiError>[0]; status: number }
      > = {
        INVITATION_INVALID: { code: "INVITATION_INVALID", status: 404 },
        INVITATION_EXPIRED: { code: "INVITATION_EXPIRED", status: 410 },
        INVITATION_REVOKED: { code: "INVITATION_REVOKED", status: 410 },
        INVITATION_ACCEPTED: { code: "INVITATION_ACCEPTED", status: 409 },
        EMAIL_MISMATCH: { code: "EMAIL_MISMATCH", status: 403 },
        PORTAL_USER_EXISTS: { code: "PORTAL_USER_EXISTS", status: 409 },
        ACCEPT_FAILED: { code: "ACCEPT_FAILED", status: 500 },
      };
      const entry = map[result.code] ?? {
        code: "ACCEPT_FAILED" as const,
        status: 500,
      };
      return clientApiError(entry.code, entry.status);
    }

    return clientApiOk({ redirectTo: result.redirectTo });
  } catch {
    return clientApiError("ACCEPT_FAILED", 500);
  }
}
