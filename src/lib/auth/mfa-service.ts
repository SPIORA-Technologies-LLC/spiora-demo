import "server-only";

import {
  createSupabaseServerAuthClient,
  isSupabaseAuthClientConfigured,
} from "@/lib/supabase/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  isEmployeeMfaEnabled,
  MFA_MAX_VERIFIED_TOTP_FACTORS,
} from "./mfa-config";
import {
  isAal2,
  needsMfaChallenge,
  type MfaAssuranceSnapshot,
} from "./mfa-aal";
import { readMfaAssurance } from "./mfa-evaluate";
import {
  countUnusedRecoveryCodes,
  replaceEmployeeRecoveryCodes,
} from "./mfa-recovery-store";
import { withAppEntrySplash } from "@/lib/layout/app-entry-splash";

export { readMfaAssurance } from "./mfa-evaluate";

export type EmployeeMfaStatus = {
  enabled: boolean;
  aal: MfaAssuranceSnapshot | null;
  challengeRequired: boolean;
  verifiedTotpCount: number;
  pendingTotpCount: number;
  verifiedFactorId: string | null;
  unusedRecoveryCodes: number;
  mfaReenrollRequired: boolean;
};

export async function getEmployeeMfaAssurance(): Promise<MfaAssuranceSnapshot | null> {
  if (!isSupabaseAuthClientConfigured()) return null;
  try {
    const supabase = await createSupabaseServerAuthClient();
    return readMfaAssurance(supabase);
  } catch {
    return null;
  }
}

/**
 * Cleanup policy for pending/unverified TOTP: remove all unverified totp factors
 * before starting a new enrollment (replace). Verified factors are never removed here.
 */
export async function cleanupUnverifiedTotpFactors(): Promise<
  { ok: true; removed: number } | { ok: false; reason: string }
> {
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, reason: "auth_unavailable" };
  }
  const supabase = await createSupabaseServerAuthClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { ok: false, reason: "list_failed" };

  const pending =
    data?.all?.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    ) ?? [];
  let removed = 0;
  for (const factor of pending) {
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });
    if (unenrollError) return { ok: false, reason: "unenroll_failed" };
    removed += 1;
  }
  return { ok: true, removed };
}

export async function getEmployeeMfaStatus(input: {
  authUserId: string;
  mfaReenrollRequired?: boolean;
}): Promise<EmployeeMfaStatus> {
  const enabled = isEmployeeMfaEnabled();
  if (!enabled || !isSupabaseAuthClientConfigured()) {
    return {
      enabled: false,
      aal: null,
      challengeRequired: false,
      verifiedTotpCount: 0,
      pendingTotpCount: 0,
      verifiedFactorId: null,
      unusedRecoveryCodes: 0,
      mfaReenrollRequired: Boolean(input.mfaReenrollRequired),
    };
  }

  const supabase = await createSupabaseServerAuthClient();
  const [snapshot, factors] = await Promise.all([
    readMfaAssurance(supabase),
    supabase.auth.mfa.listFactors(),
  ]);

  const verified = factors.data?.totp ?? [];
  const pending =
    factors.data?.all?.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    ) ?? [];
  const unusedRecoveryCodes = await countUnusedRecoveryCodes(input.authUserId);

  return {
    enabled: true,
    aal: snapshot,
    challengeRequired: needsMfaChallenge(snapshot),
    verifiedTotpCount: verified.length,
    pendingTotpCount: pending.length,
    verifiedFactorId: verified[0]?.id ?? null,
    unusedRecoveryCodes,
    mfaReenrollRequired: Boolean(input.mfaReenrollRequired),
  };
}

export async function startTotpEnrollment(friendlyName = "Authenticator"): Promise<
  | {
      ok: true;
      factorId: string;
      qrCode: string;
      secret: string;
      uri: string;
    }
  | { ok: false; code: "disabled" | "already_enrolled" | "cleanup_failed" | "enroll_failed" | "auth_unavailable" }
> {
  if (!isEmployeeMfaEnabled()) return { ok: false, code: "disabled" };
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  const supabase = await createSupabaseServerAuthClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp ?? [];
  if (verified.length >= MFA_MAX_VERIFIED_TOTP_FACTORS) {
    return { ok: false, code: "already_enrolled" };
  }

  const cleanup = await cleanupUnverifiedTotpFactors();
  if (!cleanup.ok) return { ok: false, code: "cleanup_failed" };

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error || !data || data.type !== "totp") {
    return { ok: false, code: "enroll_failed" };
  }

  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpEnrollment(input: {
  factorId: string;
  code: string;
  authUserId: string;
}): Promise<
  | { ok: true; recoveryCodes: string[] }
  | {
      ok: false;
      code: "disabled" | "verify_failed" | "recovery_failed" | "auth_unavailable";
    }
> {
  if (!isEmployeeMfaEnabled()) return { ok: false, code: "disabled" };
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  const supabase = await createSupabaseServerAuthClient();
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: input.factorId });
  if (challengeError || !challenge) {
    return { ok: false, code: "verify_failed" };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.id,
    code: input.code.trim(),
  });
  if (verifyError) return { ok: false, code: "verify_failed" };

  const recovery = await replaceEmployeeRecoveryCodes({
    authUserId: input.authUserId,
  });
  if (!recovery.ok) return { ok: false, code: "recovery_failed" };

  await getSupabaseAdmin()
    .from("user_profiles")
    .update({ mfa_reenroll_required: false })
    .eq("auth_user_id", input.authUserId);

  return { ok: true, recoveryCodes: recovery.codes };
}

export async function challengeAndVerifyTotp(input: {
  factorId: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; code: "disabled" | "verify_failed" | "auth_unavailable" }> {
  if (!isEmployeeMfaEnabled()) return { ok: false, code: "disabled" };
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  const supabase = await createSupabaseServerAuthClient();
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: input.factorId });
  if (challengeError || !challenge) {
    return { ok: false, code: "verify_failed" };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.id,
    code: input.code.trim(),
  });
  if (verifyError) return { ok: false, code: "verify_failed" };
  return { ok: true };
}

/**
 * Disable MFA (requires AAL2). Uses user unenroll, then clears recovery codes.
 */
export async function disableEmployeeMfa(input: {
  authUserId: string;
  factorId: string;
}): Promise<
  | { ok: true }
  | { ok: false; code: "disabled" | "aal2_required" | "unenroll_failed" | "auth_unavailable" }
> {
  if (!isEmployeeMfaEnabled()) return { ok: false, code: "disabled" };
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  const aal = await getEmployeeMfaAssurance();
  if (!isAal2(aal)) return { ok: false, code: "aal2_required" };

  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.auth.mfa.unenroll({
    factorId: input.factorId,
  });
  if (error) return { ok: false, code: "unenroll_failed" };

  const admin = getSupabaseAdmin();
  await admin
    .from("employee_mfa_recovery_codes")
    .delete()
    .eq("auth_user_id", input.authUserId);

  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    // best-effort revoke other sessions after MFA disable
  }

  return { ok: true };
}

export async function regenerateRecoveryCodesRequireAal2(input: {
  authUserId: string;
}): Promise<
  | { ok: true; codes: string[] }
  | { ok: false; code: "disabled" | "aal2_required" | "recovery_failed" | "auth_unavailable" }
> {
  if (!isEmployeeMfaEnabled()) return { ok: false, code: "disabled" };
  const aal = await getEmployeeMfaAssurance();
  if (!isAal2(aal)) return { ok: false, code: "aal2_required" };

  const recovery = await replaceEmployeeRecoveryCodes({
    authUserId: input.authUserId,
  });
  if (!recovery.ok) return { ok: false, code: "recovery_failed" };
  return { ok: true, codes: recovery.codes };
}

/** Post password/Google login: challenge path or intended destination. */
export async function resolveEmployeePostAuthPath(
  intendedPath: string,
): Promise<string> {
  if (!isEmployeeMfaEnabled()) return withAppEntrySplash(intendedPath);
  const aal = await getEmployeeMfaAssurance();
  if (needsMfaChallenge(aal)) {
    const next = encodeURIComponent(intendedPath);
    return `/mfa/challenge?next=${next}`;
  }
  return withAppEntrySplash(intendedPath);
}
