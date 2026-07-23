/**
 * Spiora Client invitation tokens — crypto helpers (PR #30).
 * Plaintext tokens must never be persisted or logged.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CLIENT_INVITE_TOKEN_BYTES = 32;

/** URL-safe token (base64url), ≥32 random bytes. */
export function generateClientInviteToken(): string {
  return randomBytes(CLIENT_INVITE_TOKEN_BYTES).toString("base64url");
}

/** SHA-256 hex digest of the plaintext token. */
export function hashClientInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time compare of a presented token against a stored hash.
 * Returns false on any length/format mismatch (no throw).
 */
export function verifyClientInviteToken(
  presentedToken: string,
  storedHash: string,
): boolean {
  if (!presentedToken || !storedHash || storedHash.length !== 64) {
    return false;
  }
  const presentedHash = hashClientInviteToken(presentedToken);
  try {
    return timingSafeEqual(
      Buffer.from(presentedHash, "utf8"),
      Buffer.from(storedHash, "utf8"),
    );
  } catch {
    return false;
  }
}

export type ClientInvitationState =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export function computeInvitationState(input: {
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  now?: Date;
}): ClientInvitationState {
  if (input.revokedAt) return "revoked";
  if (input.acceptedAt) return "accepted";
  const now = input.now ?? new Date();
  if (now.getTime() >= new Date(input.expiresAt).getTime()) return "expired";
  return "pending";
}

/** Mask email for public invite preview: c***@example.com */
export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function normalizeInviteEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.length > 320) return null;
  // Practical RFC-lite check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Smoke / staging cutover invites must not clutter the employee UI.
 * Matches @example.com and common automated smoke email prefixes.
 */
export function isInternalTestInviteEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.endsWith("@example.com")) return true;
  const local = normalized.split("@")[0] ?? "";
  return (
    local.startsWith("smoke-") ||
    local.startsWith("case-smoke-") ||
    local.startsWith("q-smoke-") ||
    local.startsWith("demo-smoke-") ||
    local.startsWith("bad-")
  );
}

export function buildClientInvitePath(token: string): string {
  return `/client/invite/${encodeURIComponent(token)}`;
}

export function buildClientInviteUrl(token: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${buildClientInvitePath(token)}`;
}

/** Strip secrets — never include tokenHash in public JSON. */
export function assertInvitationDtoHasNoTokenHash(dto: unknown): void {
  const json = JSON.stringify(dto);
  if (json.includes("tokenHash") || json.includes("token_hash")) {
    throw new Error("invitation_dto_leaked_hash");
  }
}
