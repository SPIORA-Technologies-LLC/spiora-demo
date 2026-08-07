import { NextResponse } from "next/server";
import { requireEmployeeForMfa, requestMeta } from "@/lib/auth/mfa-api";
import {
  challengeAndVerifyTotp,
  getEmployeeMfaStatus,
} from "@/lib/auth/mfa-service";
import { checkPasswordFlowRateLimit } from "@/lib/auth/password-rate-limit";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
} from "@/lib/auth/security-audit";
import { hashAuditIp, truncateClientIp } from "@/lib/auth/password-recovery-gate";
import { canAccessPath } from "@/lib/auth/permissions";
import { resolvePostLoginPath } from "@/lib/auth/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireEmployeeForMfa();
  if (!gate.ok) return gate.response;

  const { ip, userAgent } = requestMeta(request);
  const rate = await checkPasswordFlowRateLimit(
    "mfa-challenge",
    gate.session.authUserId!,
    ip,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" } },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { code?: string; next?: string };
  try {
    body = (await request.json()) as { code?: string; next?: string };
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const code = String(body.code ?? "").trim();
  if (!code) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const status = await getEmployeeMfaStatus({
    authUserId: gate.session.authUserId!,
  });
  if (!status.verifiedFactorId) {
    return NextResponse.json(
      { error: { code: "NO_FACTOR" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await challengeAndVerifyTotp({
    factorId: status.verifiedFactorId,
    code,
  });

  if (!result.ok) {
    const audit = await insertSecurityAuditEvent({
      action: "mfa_challenge_failure",
      audience: "employee",
      actorUserId: gate.session.authUserId,
      targetUserId: gate.session.authUserId,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
    });
    if (!audit.ok && audit.reason !== "audit_disabled") {
      reportSecurityAuditFailure({
        action: "mfa_challenge_failure",
        audience: "employee",
        reason: audit.reason,
      });
    }
    return NextResponse.json(
      { error: { code: "VERIFY_FAILED" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const audit = await insertSecurityAuditEvent({
    action: "mfa_challenge_success",
    audience: "employee",
    actorUserId: gate.session.authUserId,
    targetUserId: gate.session.authUserId,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    userAgent,
  });
  if (!audit.ok && audit.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: "mfa_challenge_success",
      audience: "employee",
      reason: audit.reason,
    });
  }

  const destination = resolvePostLoginPath(String(body.next ?? "").trim(), (path) =>
    canAccessPath(gate.session.role, path),
  );

  return NextResponse.json(
    { redirectTo: destination },
    { headers: { "Cache-Control": "no-store" } },
  );
}
