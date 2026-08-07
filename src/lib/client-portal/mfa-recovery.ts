import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createSupabaseServerAuthClient,
  isSupabaseAuthClientConfigured,
} from "@/lib/supabase/server-auth";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
  type SecurityAuditInsert,
} from "@/lib/auth/security-audit";
import { hashAuditIp, truncateClientIp } from "@/lib/auth/password-recovery-gate";
import { isClientMfaEnabled } from "./mfa-config";
import {
  consumeClientRecoveryCode,
  wipeClientRecoveryCodes,
} from "./mfa-recovery-store";

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
 * Client recovery-at-login (NOT AAL2):
 * consume code → admin delete TOTP → wipe codes → mfa_reenroll_required
 * → global sign-out → caller redirects to /client/login?mfa_reenroll=1
 */
export async function recoverClientMfaWithCode(input: {
  authUserId: string;
  code: string;
  ip?: string;
  userAgent?: string | null;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      code:
        | "disabled"
        | "invalid_code"
        | "no_factors"
        | "admin_error"
        | "pepper_missing"
        | "store_error"
        | "auth_unavailable";
    }
> {
  if (!isClientMfaEnabled()) return { ok: false, code: "disabled" };
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

  const consumed = await consumeClientRecoveryCode({
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
    audience: "client",
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
      audience: "client",
      actorUserId: input.authUserId,
      targetUserId: input.authUserId,
      truncatedClientIp: truncateClientIp(input.ip),
      ipHash: input.ip ? hashAuditIp(input.ip) : null,
      userAgent: input.userAgent ?? null,
      metadata: { via: "recovery", factor_id: factor.id },
    });
  }

  await wipeClientRecoveryCodes(input.authUserId);

  await admin
    .from("client_portal_users")
    .update({ mfa_reenroll_required: true })
    .eq("auth_user_id", input.authUserId);

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
    audience: "client",
    actorUserId: input.authUserId,
    targetUserId: input.authUserId,
    truncatedClientIp: truncateClientIp(input.ip),
    ipHash: input.ip ? hashAuditIp(input.ip) : null,
    userAgent: input.userAgent ?? null,
    metadata: { reason: "mfa_recovery" },
  });

  return { ok: true };
}
