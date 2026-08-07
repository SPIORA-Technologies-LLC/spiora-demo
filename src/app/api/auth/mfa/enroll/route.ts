import { NextResponse } from "next/server";
import { requireEmployeeForMfa, requestMeta } from "@/lib/auth/mfa-api";
import { startTotpEnrollment } from "@/lib/auth/mfa-service";
import { checkPasswordFlowRateLimit } from "@/lib/auth/password-rate-limit";
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
  const rate = await checkPasswordFlowRateLimit(
    "mfa-enroll",
    gate.session.authUserId!,
    ip,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" } },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await startTotpEnrollment();
  if (!result.ok) {
    const status =
      result.code === "already_enrolled"
        ? 409
        : result.code === "disabled"
          ? 404
          : 400;
    return NextResponse.json(
      { error: { code: result.code.toUpperCase() } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const audit = await insertSecurityAuditEvent({
    action: "mfa_enroll_started",
    audience: "employee",
    actorUserId: gate.session.authUserId,
    targetUserId: gate.session.authUserId,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    userAgent,
  });
  if (!audit.ok && audit.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: "mfa_enroll_started",
      audience: "employee",
      reason: audit.reason,
    });
  }

  return NextResponse.json(
    {
      factorId: result.factorId,
      qrCode: result.qrCode,
      secret: result.secret,
      uri: result.uri,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
