import { checkRequestOrigin } from "@/lib/auth/security";
import { getSession } from "@/lib/auth/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { sendClientInvitationPasswordReset } from "@/lib/client-portal/send-client-password-reset";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Staff-triggered client password recovery (Phase D1).
 * Browser POSTs should send Origin; missing Origin is fail-closed on this route only.
 * Shared Phase A checkRequestOrigin remains permissive elsewhere (security follow-up).
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);
  if (session.role !== "owner" && session.role !== "manager") {
    return clientApiError("FORBIDDEN", 403);
  }

  const originHeader = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!originHeader) {
    return clientApiError("ORIGIN_MISMATCH", 403);
  }
  const originCheck = checkRequestOrigin(originHeader, host);
  if (!originCheck.ok) {
    return clientApiError("ORIGIN_MISMATCH", 403);
  }

  const { id } = await params;
  if (!id) return clientApiError("NOT_FOUND", 404);

  // Intentionally ignore body — email must come from the invitation row only.
  try {
    await request.json();
  } catch {
    // body optional / empty
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent");

  try {
    const result = await sendClientInvitationPasswordReset({
      invitationId: id,
      actorUserId: session.authUserId ?? session.id,
      ip,
      userAgent,
    });

    if (!result.ok) {
      if (result.code === "RATE_LIMITED") {
        return clientApiError("RATE_LIMITED", 429);
      }
      if (result.code === "AUTH_UNAVAILABLE") {
        return clientApiError("AUTH_UNAVAILABLE", 503);
      }
      if (result.code === "NOT_FOUND") {
        return clientApiError("NOT_FOUND", 404);
      }
      return clientApiError("INVITATION_INVALID", 400);
    }

    return clientApiOk({ ok: true });
  } catch {
    return clientApiError("INTERNAL", 500);
  }
}
