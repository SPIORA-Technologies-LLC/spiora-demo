/**
 * Canonical app origin for auth redirects.
 * Never trust Host / X-Forwarded-Host alone.
 */

export function getCanonicalAppOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getAllowedAppOrigins(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const origins = new Set<string>();
  const primary = getCanonicalAppOrigin(env);
  if (primary) origins.add(primary);

  const extra = env.SPIORA_ALLOWED_APP_ORIGINS?.trim();
  if (extra) {
    for (const part of extra.split(/[,;]/)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        const url = new URL(trimmed);
        if (url.protocol === "http:" || url.protocol === "https:") {
          origins.add(url.origin);
        }
      } catch {
        // skip
      }
    }
  }
  return origins;
}

export function buildPasswordRecoveryConfirmUrl(
  audience: "employee" | "client",
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const origin = getCanonicalAppOrigin(env);
  if (!origin) return null;
  const path =
    audience === "employee"
      ? "/auth/confirm/employee"
      : "/auth/confirm/client";
  // No query string — email template appends ?token_hash=&type=recovery
  return `${origin}${path}`;
}
