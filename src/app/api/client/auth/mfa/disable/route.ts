import { NextResponse } from "next/server";
import { requireClientForMfa, requestMeta } from "@/lib/client-portal/mfa-api";
import {
  disableClientMfa,
  getClientMfaStatus,
} from "@/lib/client-portal/mfa-service";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
} from "@/lib/auth/security-audit";
import { hashAuditIp, truncateClientIp } from "@/lib/auth/password-recovery-gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireClientForMfa();
  if (!gate.ok) return gate.response;

  const { ip, userAgent } = requestMeta(request);
  const status = await getClientMfaStatus({
    authUserId: gate.session.authUserId,
  });
  if (!status.verifiedFactorId) {
    return NextResponse.json(
      { error: { code: "NO_FACTOR" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await disableClientMfa({
    authUserId: gate.session.authUserId,
    factorId: status.verifiedFactorId,
  });
  if (!result.ok) {
    const http =
      result.code === "aal2_required"
        ? 403
        : result.code === "disabled"
          ? 404
          : 400;
    return NextResponse.json(
      { error: { code: result.code.toUpperCase() } },
      { status: http, headers: { "Cache-Control": "no-store" } },
    );
  }

  for (const action of [
    "mfa_disabled",
    "mfa_factor_removed",
    "sessions_revoked",
  ] as const) {
    const audit = await insertSecurityAuditEvent({
      action,
      audience: "client",
      actorUserId: gate.session.authUserId,
      targetUserId: gate.session.authUserId,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
      metadata:
        action === "sessions_revoked" ? { reason: "mfa_disabled" } : undefined,
    });
    if (!audit.ok && audit.reason !== "audit_disabled") {
      reportSecurityAuditFailure({
        action,
        audience: "client",
        reason: audit.reason,
      });
    }
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
