import "server-only";

import {
  generateRecoveryCodes,
  getMfaRecoveryPepper,
  hashRecoveryCode,
  normalizeRecoveryCode,
  CLIENT_MFA_RECOVERY_HMAC_PREFIX,
} from "@/lib/auth/mfa-recovery-codes";
import { MFA_RECOVERY_CODE_COUNT } from "@/lib/auth/mfa-config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashAuditIp } from "@/lib/auth/password-recovery-gate";

export type ConsumeRecoveryCodeResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "pepper_missing" | "store_error" };

function hashClientCode(code: string, pepper: string): string {
  return hashRecoveryCode(code, pepper, CLIENT_MFA_RECOVERY_HMAC_PREFIX);
}

/**
 * Atomically consume one unused client recovery code.
 */
export async function consumeClientRecoveryCode(input: {
  authUserId: string;
  code: string;
  ip?: string;
}): Promise<ConsumeRecoveryCodeResult> {
  const pepper = getMfaRecoveryPepper();
  if (!pepper) return { ok: false, code: "pepper_missing" };

  const normalized = normalizeRecoveryCode(input.code);
  if (normalized.length < 8) return { ok: false, code: "invalid" };

  const codeHash = hashClientCode(normalized, pepper);
  const sb = getSupabaseAdmin();
  const usedIpHash = input.ip ? hashAuditIp(input.ip) : null;

  const { data, error } = await sb
    .from("client_mfa_recovery_codes")
    .update({
      used_at: new Date().toISOString(),
      used_ip_hash: usedIpHash,
    })
    .eq("auth_user_id", input.authUserId)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, code: "store_error" };
  if (!data?.id) return { ok: false, code: "invalid" };
  return { ok: true };
}

export async function replaceClientRecoveryCodes(input: {
  authUserId: string;
  count?: number;
}): Promise<
  | { ok: true; codes: string[] }
  | { ok: false; code: "pepper_missing" | "store_error" }
> {
  const pepper = getMfaRecoveryPepper();
  if (!pepper) return { ok: false, code: "pepper_missing" };

  const codes = generateRecoveryCodes(input.count ?? MFA_RECOVERY_CODE_COUNT);
  const sb = getSupabaseAdmin();

  const { error: delError } = await sb
    .from("client_mfa_recovery_codes")
    .delete()
    .eq("auth_user_id", input.authUserId);
  if (delError) return { ok: false, code: "store_error" };

  const rows = codes.map((code) => ({
    auth_user_id: input.authUserId,
    code_hash: hashClientCode(code, pepper),
  }));

  const { error: insertError } = await sb
    .from("client_mfa_recovery_codes")
    .insert(rows);
  if (insertError) return { ok: false, code: "store_error" };

  return { ok: true, codes };
}

export async function countUnusedClientRecoveryCodes(
  authUserId: string,
): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("client_mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", authUserId)
    .is("used_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function wipeClientRecoveryCodes(authUserId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb
    .from("client_mfa_recovery_codes")
    .delete()
    .eq("auth_user_id", authUserId);
}
