import { NextResponse } from "next/server";
import { requireClientForMfa, requestMeta } from "@/lib/client-portal/mfa-api";
import { verifyClientTotpEnrollment } from "@/lib/client-portal/mfa-service";
import { checkPasswordFlowRateLimit } from "@/lib/auth/password-rate-limit";
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
  const rate = await checkPasswordFlowRateLimit(
    "client-mfa-enroll",
    gate.session.authUserId,
    ip,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" } },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { factorId?: string; code?: string };
  try {
    body = (await request.json()) as { factorId?: string; code?: string };
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const factorId = String(body.factorId ?? "").trim();
  const code = String(body.code ?? "").trim();
  if (!factorId || !code) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await verifyClientTotpEnrollment({
    factorId,
    code,
    authUserId: gate.session.authUserId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code.toUpperCase() } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  for (const action of [
    "mfa_enroll_completed",
    "mfa_recovery_codes_generated",
  ] as const) {
    const audit = await insertSecurityAuditEvent({
      action,
      audience: "client",
      actorUserId: gate.session.authUserId,
      targetUserId: gate.session.authUserId,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
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
    { recoveryCodes: result.recoveryCodes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
