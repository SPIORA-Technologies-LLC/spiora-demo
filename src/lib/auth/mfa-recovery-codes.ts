import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MFA_RECOVERY_CODE_COUNT } from "./mfa-config";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Pepper for hashing recovery codes at rest.
 * Prefer dedicated SPIORA_MFA_RECOVERY_PEPPER; fall back to audit pepper / AUTH_SECRET.
 */
export function getMfaRecoveryPepper(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const dedicated = env.SPIORA_MFA_RECOVERY_PEPPER?.trim();
  if (dedicated) return dedicated;
  const audit = env.SPIORA_AUDIT_HMAC_PEPPER?.trim();
  if (audit) return audit;
  const auth = env.AUTH_SECRET?.trim();
  return auth || null;
}

export function normalizeRecoveryCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatRecoveryCode(normalized: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += 4) {
    chunks.push(normalized.slice(i, i + 4));
  }
  return chunks.join("-");
}

function randomCodeSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** Generate plaintext recovery codes (show once). Each is 8 chars → XXXX-XXXX. */
export function generateRecoveryCodes(
  count: number = MFA_RECOVERY_CODE_COUNT,
): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  while (codes.length < count) {
    const normalized = randomCodeSegment(8);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    codes.push(formatRecoveryCode(normalized));
  }
  return codes;
}

/** Domain separation for client recovery hashes (employee hashes stay unprefixed). */
export const CLIENT_MFA_RECOVERY_HMAC_PREFIX = "client-mfa-recovery:";

/**
 * Hash a recovery code at rest.
 * Employee: HMAC(pepper, normalized) — unchanged for production codes.
 * Client: pass domainPrefix = CLIENT_MFA_RECOVERY_HMAC_PREFIX.
 */
export function hashRecoveryCode(
  code: string,
  pepper: string,
  domainPrefix = "",
): string {
  const normalized = normalizeRecoveryCode(code);
  return createHmac("sha256", pepper)
    .update(domainPrefix + normalized)
    .digest("hex");
}

export function recoveryCodesMatch(
  aHex: string,
  bHex: string,
): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
