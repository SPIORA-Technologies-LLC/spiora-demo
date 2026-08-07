import { NextResponse } from "next/server";
import { requireEmployeeForMfa, requestMeta } from "@/lib/auth/mfa-api";
import { regenerateRecoveryCodesRequireAal2 } from "@/lib/auth/mfa-service";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
} from "@/lib/auth/security-audit";
import { hashAuditIp, truncateClientIp } from "@/lib/auth/password-recovery-gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireEmployeeForMfa();
  if (!gate.ok) return gate.response;

  const { ip, userAgent } = requestMeta(request);
  const result = await regenerateRecoveryCodesRequireAal2({
    authUserId: gate.session.authUserId!,
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

  const audit = await insertSecurityAuditEvent({
    action: "mfa_recovery_codes_generated",
    audience: "employee",
    actorUserId: gate.session.authUserId,
    targetUserId: gate.session.authUserId,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    userAgent,
    metadata: { regenerated: true },
  });
  if (!audit.ok && audit.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: "mfa_recovery_codes_generated",
      audience: "employee",
      reason: audit.reason,
    });
  }

  return NextResponse.json(
    { recoveryCodes: result.codes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
