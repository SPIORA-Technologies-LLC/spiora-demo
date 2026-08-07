import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createSupabaseServerAuthClient,
  isSupabaseAuthClientConfigured,
} from "@/lib/supabase/server-auth";
import {
  MFA_MAX_VERIFIED_TOTP_FACTORS,
} from "@/lib/auth/mfa-config";
import {
  isAal2,
  needsMfaChallenge,
  type MfaAssuranceSnapshot,
} from "@/lib/auth/mfa-aal";
import { readMfaAssurance } from "@/lib/auth/mfa-evaluate";
import { cleanupUnverifiedTotpFactors } from "@/lib/auth/mfa-service";
import { isClientMfaEnabled } from "./mfa-config";
import {
  countUnusedClientRecoveryCodes,
  replaceClientRecoveryCodes,
  wipeClientRecoveryCodes,
} from "./mfa-recovery-store";
import { withClientPortalEntrySplash } from "./entry-splash";

export { resolveClientPostMfaPath } from "./mfa-redirect";

export type ClientMfaStatus = {
  enabled: boolean;
  aal: MfaAssuranceSnapshot | null;
  challengeRequired: boolean;
  verifiedTotpCount: number;
  pendingTotpCount: number;
  verifiedFactorId: string | null;
  unusedRecoveryCodes: number;
  mfaReenrollRequired: boolean;
};

export async function getClientMfaAssurance(): Promise<MfaAssuranceSnapshot | null> {
  if (!isSupabaseAuthClientConfigured()) return null;
  try {
    const supabase = await createSupabaseServerAuthClient();
    return readMfaAssurance(supabase);
  } catch {
    return null;
  }
}

export async function getClientMfaStatus(input: {
  authUserId: string;
  mfaReenrollRequired?: boolean;
}): Promise<ClientMfaStatus> {
  const enabled = isClientMfaEnabled();
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
  const unusedRecoveryCodes = await countUnusedClientRecoveryCodes(
    input.authUserId,
  );

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

export async function startClientTotpEnrollment(
  friendlyName = "Authenticator",
): Promise<
  | {
      ok: true;
      factorId: string;
      qrCode: string;
      secret: string;
      uri: string;
    }
  | {
      ok: false;
      code:
        | "disabled"
        | "already_enrolled"
        | "cleanup_failed"
        | "enroll_failed"
        | "auth_unavailable";
    }
> {
  if (!isClientMfaEnabled()) return { ok: false, code: "disabled" };
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

export async function verifyClientTotpEnrollment(input: {
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
  if (!isClientMfaEnabled()) return { ok: false, code: "disabled" };
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

  const recovery = await replaceClientRecoveryCodes({
    authUserId: input.authUserId,
  });
  if (!recovery.ok) return { ok: false, code: "recovery_failed" };

  await getSupabaseAdmin()
    .from("client_portal_users")
    .update({ mfa_reenroll_required: false })
    .eq("auth_user_id", input.authUserId);

  return { ok: true, recoveryCodes: recovery.codes };
}

export async function challengeAndVerifyClientTotp(input: {
  factorId: string;
  code: string;
}): Promise<
  | { ok: true }
  | { ok: false; code: "disabled" | "verify_failed" | "auth_unavailable" }
> {
  if (!isClientMfaEnabled()) return { ok: false, code: "disabled" };
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

export async function disableClientMfa(input: {
  authUserId: string;
  factorId: string;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      code: "disabled" | "aal2_required" | "unenroll_failed" | "auth_unavailable";
    }
> {
  if (!isClientMfaEnabled()) return { ok: false, code: "disabled" };
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  const aal = await getClientMfaAssurance();
  if (!isAal2(aal)) return { ok: false, code: "aal2_required" };

  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.auth.mfa.unenroll({
    factorId: input.factorId,
  });
  if (error) return { ok: false, code: "unenroll_failed" };

  await wipeClientRecoveryCodes(input.authUserId);
  await getSupabaseAdmin()
    .from("client_portal_users")
    .update({ mfa_reenroll_required: false })
    .eq("auth_user_id", input.authUserId);

  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    // best-effort
  }

  return { ok: true };
}

export async function regenerateClientRecoveryCodesRequireAal2(input: {
  authUserId: string;
}): Promise<
  | { ok: true; codes: string[] }
  | {
      ok: false;
      code: "disabled" | "aal2_required" | "recovery_failed" | "auth_unavailable";
    }
> {
  if (!isClientMfaEnabled()) return { ok: false, code: "disabled" };
  const aal = await getClientMfaAssurance();
  if (!isAal2(aal)) return { ok: false, code: "aal2_required" };

  const recovery = await replaceClientRecoveryCodes({
    authUserId: input.authUserId,
  });
  if (!recovery.ok) return { ok: false, code: "recovery_failed" };
  return { ok: true, codes: recovery.codes };
}

/** Post password/Google login: challenge or portal entry. */
export async function resolveClientPostAuthPath(
  intendedPath = "/client",
): Promise<string> {
  if (!isClientMfaEnabled()) {
    return withClientPortalEntrySplash(intendedPath);
  }
  const aal = await getClientMfaAssurance();
  if (needsMfaChallenge(aal)) {
    const next = encodeURIComponent(intendedPath);
    return `/client/mfa/challenge?next=${next}`;
  }
  return withClientPortalEntrySplash(intendedPath);
}
