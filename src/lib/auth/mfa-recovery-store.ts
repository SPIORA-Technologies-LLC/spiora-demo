import "server-only";

import {
  generateRecoveryCodes,
  getMfaRecoveryPepper,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "./mfa-recovery-codes";
import { MFA_RECOVERY_CODE_COUNT } from "./mfa-config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashAuditIp } from "./password-recovery-gate";

export type ConsumeRecoveryCodeResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "pepper_missing" | "store_error" };

/**
 * Atomically consume one unused recovery code for the auth user.
 */
export async function consumeEmployeeRecoveryCode(input: {
  authUserId: string;
  code: string;
  ip?: string;
}): Promise<ConsumeRecoveryCodeResult> {
  const pepper = getMfaRecoveryPepper();
  if (!pepper) return { ok: false, code: "pepper_missing" };

  const normalized = normalizeRecoveryCode(input.code);
  if (normalized.length < 8) return { ok: false, code: "invalid" };

  const codeHash = hashRecoveryCode(normalized, pepper);
  const sb = getSupabaseAdmin();
  const usedIpHash = input.ip ? hashAuditIp(input.ip) : null;

  const { data, error } = await sb
    .from("employee_mfa_recovery_codes")
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

export async function replaceEmployeeRecoveryCodes(input: {
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
    .from("employee_mfa_recovery_codes")
    .delete()
    .eq("auth_user_id", input.authUserId);
  if (delError) return { ok: false, code: "store_error" };

  const rows = codes.map((code) => ({
    auth_user_id: input.authUserId,
    code_hash: hashRecoveryCode(code, pepper),
  }));

  const { error: insertError } = await sb
    .from("employee_mfa_recovery_codes")
    .insert(rows);
  if (insertError) return { ok: false, code: "store_error" };

  return { ok: true, codes };
}

export async function countUnusedRecoveryCodes(
  authUserId: string,
): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("employee_mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", authUserId)
    .is("used_at", null);
  if (error) return 0;
  return count ?? 0;
}
