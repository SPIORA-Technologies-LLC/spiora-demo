import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import {
  createClientInvitation,
  listClientInvitations,
} from "@/lib/client-portal/invitations";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

function getRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function GET() {
  const session = await getSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);
  if (session.role !== "owner" && session.role !== "manager") {
    return clientApiError("FORBIDDEN", 403);
  }

  try {
    const invitations = await listClientInvitations();
    return clientApiOk({ invitations });
  } catch {
    return clientApiError("INTERNAL", 500);
  }
}

export async function POST(request: Request) {
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return clientApiError("INVALID_BODY", 400);
  }

  const requestIdHeader = request.headers.get("idempotency-key");
  const requestId =
    (typeof body.requestId === "string" && body.requestId) ||
    requestIdHeader ||
    null;

  try {
    const result = await createClientInvitation({
      email: typeof body.email === "string" ? body.email : "",
      preferredLocale:
        typeof body.preferredLocale === "string"
          ? body.preferredLocale
          : undefined,
      serviceType:
        typeof body.serviceType === "string" ? body.serviceType : null,
      assignedTo:
        typeof body.assignedTo === "string"
          ? body.assignedTo
          : body.assignedTo === null
            ? null
            : undefined,
      expiresInDays:
        typeof body.expiresInDays === "number" ? body.expiresInDays : undefined,
      requestId,
      createdBy: session.id,
      employeeRole: session.role,
      origin: getRequestOrigin(request),
    });

    if (!result.ok) {
      const status =
        result.code === "INVALID_EMAIL" ||
        result.code === "INVALID_LOCALE" ||
        result.code === "INVALID_EXPIRY" ||
        result.code === "INVALID_ASSIGNEE" ||
        result.code === "ASSIGNEE_REQUIRED"
          ? 400
          : 400;
      return clientApiError(
        result.code as
          | "INVALID_EMAIL"
          | "INVALID_LOCALE"
          | "INVALID_EXPIRY"
          | "INVALID_ASSIGNEE"
          | "ASSIGNEE_REQUIRED",
        status,
      );
    }

    // Never log inviteUrl / token
    return clientApiOk(
      {
        invitation: result.invitation,
        inviteUrl: result.inviteUrl,
        reused: result.reused,
      },
      { status: result.reused ? 200 : 201 },
    );
  } catch {
    return clientApiError("INTERNAL", 500);
  }
}

/** Explicitly reject unexpected methods with stable shape */
export async function PUT() {
  return NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } },
    { status: 405 },
  );
}
