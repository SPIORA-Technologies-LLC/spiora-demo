import "server-only";

/**
 * CSRF / open-redirect helpers for mutating auth actions.
 * Does not invent a refresh-token layer on top of Supabase.
 */

export function isSafeAppPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("://")) return false;
  return true;
}

export function resolvePostLoginPath(
  nextPath: string,
  canAccess: (path: string) => boolean,
  fallback = "/dashboard",
): string {
  const trimmed = nextPath.trim();
  if (!trimmed) return fallback;
  if (!isSafeAppPath(trimmed)) return fallback;
  if (!canAccess(trimmed)) return fallback;
  return trimmed;
}

export type OriginCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing-origin" | "origin-mismatch" };

/**
 * Best-effort Origin/Host check for cookie-authenticated mutations.
 * SameSite=Lax already reduces CSRF risk; this adds defense in depth.
 */
export function checkRequestOrigin(
  origin: string | null,
  host: string | null,
): OriginCheckResult {
  if (!origin) {
    // Server Actions / some clients may omit Origin; do not hard-fail here.
    return { ok: true };
  }
  if (!host) {
    return { ok: false, reason: "missing-origin" };
  }

  try {
    const originHost = new URL(origin).host;
    const expected = host.split(",")[0]?.trim();
    if (!expected || originHost !== expected) {
      return { ok: false, reason: "origin-mismatch" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "origin-mismatch" };
  }
}

/** Never log passwords or raw provider secrets. */
export function sanitizeAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("password") ||
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("email not confirmed")
  ) {
    return "invalid_credentials";
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "rate_limited";
  }
  return "auth_unavailable";
}
