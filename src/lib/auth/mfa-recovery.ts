import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createSupabaseServerAuthClient,
  isSupabaseAuthClientConfigured,
} from "@/lib/supabase/server-auth";
import { consumeEmployeeRecoveryCode } from "./mfa-recovery-store";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
  type SecurityAuditInsert,
} from "./security-audit";
import { hashAuditIp, truncateClientIp } from "./password-recovery-gate";

async function safeAudit(input: SecurityAuditInsert): Promise<void> {
  const result = await insertSecurityAuditEvent(input);
  if (!result.ok && result.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: input.action,
      audience: input.audience,
      reason: result.reason,
    });
  }
}

/**
 * Recovery-at-login (NOT AAL2):
 * 1) consume one-time recovery code
 * 2) admin-delete verified (and any) TOTP factors
 * 3) mark sessions compromised → global sign-out
 * 4) set mfa_reenroll_required
 * 5) caller redirects to fresh password/Google login
 *
 * Must use admin deleteFactor — user unenroll requires AAL2.
 * Admin factor deletion invalidates active sessions; do not promote current session.
 */
export async function recoverEmployeeMfaWithCode(input: {
  authUserId: string;
  code: string;
  ip?: string;
  userAgent?: string | null;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      code:
        | "invalid_code"
        | "no_factors"
        | "admin_error"
        | "pepper_missing"
        | "store_error"
        | "auth_unavailable";
    }
> {
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  const admin = getSupabaseAdmin();
  const { data: listed, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: input.authUserId,
  });
  if (listError) return { ok: false, code: "admin_error" };

  const factors = listed?.factors ?? [];
  const totpFactors = factors.filter((f) => f.factor_type === "totp");
  if (totpFactors.length === 0) {
    return { ok: false, code: "no_factors" };
  }

  const consumed = await consumeEmployeeRecoveryCode({
    authUserId: input.authUserId,
    code: input.code,
    ip: input.ip,
  });
  if (!consumed.ok) {
    if (consumed.code === "pepper_missing") {
      return { ok: false, code: "pepper_missing" };
    }
    if (consumed.code === "store_error") {
      return { ok: false, code: "store_error" };
    }
    return { ok: false, code: "invalid_code" };
  }

  await safeAudit({
    action: "mfa_recovery_used",
    audience: "employee",
    actorUserId: input.authUserId,
    targetUserId: input.authUserId,
    truncatedClientIp: truncateClientIp(input.ip),
    ipHash: input.ip ? hashAuditIp(input.ip) : null,
    userAgent: input.userAgent ?? null,
    metadata: { factors_removed: totpFactors.length },
  });

  for (const factor of totpFactors) {
    const { error: delError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: input.authUserId,
    });
    if (delError) {
      return { ok: false, code: "admin_error" };
    }
    await safeAudit({
      action: "mfa_factor_removed",
      audience: "employee",
      actorUserId: input.authUserId,
      targetUserId: input.authUserId,
      truncatedClientIp: truncateClientIp(input.ip),
      ipHash: input.ip ? hashAuditIp(input.ip) : null,
      userAgent: input.userAgent ?? null,
      metadata: { via: "recovery", factor_id: factor.id },
    });
  }

  await admin
    .from("user_profiles")
    .update({ mfa_reenroll_required: true })
    .eq("auth_user_id", input.authUserId);

  // Treat all sessions as compromised. Admin MFA delete invalidates sessions;
  // also explicit global sign-out. Do not promote the current AAL1 session.
  try {
    const userClient = await createSupabaseServerAuthClient();
    const {
      data: { session },
    } = await userClient.auth.getSession();
    const jwt = session?.access_token;
    await userClient.auth.signOut({ scope: "global" });
    if (jwt) {
      await admin.auth.admin.signOut(jwt, "global");
    }
  } catch {
    // best-effort
  }

  await safeAudit({
    action: "sessions_revoked",
    audience: "employee",
    actorUserId: input.authUserId,
    targetUserId: input.authUserId,
    truncatedClientIp: truncateClientIp(input.ip),
    ipHash: input.ip ? hashAuditIp(input.ip) : null,
    userAgent: input.userAgent ?? null,
    metadata: { reason: "mfa_recovery" },
  });

  return { ok: true };
}
