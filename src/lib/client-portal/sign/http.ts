import { getClientSession } from "@/lib/client-portal/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { SignError, SIGN_ERROR_CODES } from "@/lib/client-portal/sign/errors";
import { readRequestAuditMeta } from "@/lib/client-portal/sign/request-meta";
import { checkRequestOrigin } from "@/lib/auth/security";
import type { ClientApiErrorCode } from "@/lib/client-portal/api-errors";

export function clientOriginDenied(request: Request) {
  const originCheck = checkRequestOrigin(
    request.headers.get("origin"),
    request.headers.get("host"),
  );
  return !originCheck.ok && originCheck.reason === "origin-mismatch";
}

export function signErrorResponse(error: unknown) {
  if (error instanceof SignError) {
    return clientApiError(error.code as ClientApiErrorCode, error.httpStatus);
  }
  if (error instanceof Error && error.message === "SIGN_TABLE_MISSING") {
    return clientApiError("CONTRACT_NOT_FOUND", 404);
  }
  if (error instanceof Error && SIGN_ERROR_CODES.includes(error.message as never)) {
    return clientApiError(error.message as ClientApiErrorCode, 400);
  }
  console.error(
    "[spiora-sign]",
    error instanceof Error ? `${error.name}: ${error.message}` : "error",
  );
  return clientApiError("INTERNAL", 500);
}

export async function requireClient(request: Request) {
  if (clientOriginDenied(request)) {
    return { ok: false as const, response: clientApiError("ORIGIN_MISMATCH", 403) };
  }
  const session = await getClientSession();
  if (!session) {
    return { ok: false as const, response: clientApiError("UNAUTHORIZED", 401) };
  }
  return {
    ok: true as const,
    session,
    meta: readRequestAuditMeta(request),
  };
}
