import { checkRequestOrigin } from "@/lib/auth/security";
import { getSession } from "@/lib/auth/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { sendClientInviteEmail } from "@/lib/client-portal/invite-email";
import { resetClientInvitationCredentials } from "@/lib/client-portal/invitations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function getRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function POST(request: Request, { params }: Params) {
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

  const { id } = await params;
  if (!id) return clientApiError("NOT_FOUND", 404);

  let firstName: string | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.firstName === "string") firstName = body.firstName;
  } catch {
    // body optional
  }

  try {
    const result = await resetClientInvitationCredentials({
      id,
      origin: getRequestOrigin(request),
      firstName,
    });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "AUTH_PROVISION_FAILED"
            ? 502
            : 400;
      return clientApiError(
        result.code as
          | "NOT_FOUND"
          | "INVITATION_INVALID"
          | "AUTH_PROVISION_FAILED",
        status,
      );
    }

    const mail = await sendClientInviteEmail({
      to: result.email,
      inviteUrl: result.inviteUrl,
      temporaryPassword: result.temporaryPassword,
      locale: result.preferredLocale,
      kind: "password_reset",
      firstName: firstName ?? result.firstName,
    });

    return clientApiOk({
      email: result.email,
      temporaryPassword: result.temporaryPassword,
      inviteUrl: result.inviteUrl,
      state: result.state,
      emailSent: mail.ok,
      emailError: mail.ok ? null : mail.code,
    });
  } catch {
    return clientApiError("INTERNAL", 500);
  }
}
