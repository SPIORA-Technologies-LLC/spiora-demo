/** Pure env resolution — safe for middleware and server. No secrets. */

export type AuthProvider = "legacy" | "supabase";

export type AuthProviderResolution = {
  provider: AuthProvider;
  reason:
    | "explicit-supabase"
    | "explicit-legacy"
    | "production-force-supabase"
    | "vercel-force-supabase"
    | "local-default-legacy"
    | "local-default-supabase";
  legacyAllowed: boolean;
};

function isProductionLike(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" || env.VERCEL === "1";
}

/**
 * Resolves auth provider without silent fallback from supabase → legacy.
 * Production/Vercel always force supabase.
 * Legacy is only for local development with SPIORA_AUTH_PROVIDER=legacy
 * (and optionally SPIORA_ALLOW_LEGACY_AUTH=true).
 */
export function resolveAuthProvider(
  env: NodeJS.ProcessEnv = process.env,
): AuthProviderResolution {
  const explicit = env.SPIORA_AUTH_PROVIDER?.trim().toLowerCase();
  const allowLegacyFlag =
    env.SPIORA_ALLOW_LEGACY_AUTH?.trim().toLowerCase() === "true";
  const productionLike = isProductionLike(env);

  if (productionLike) {
    return {
      provider: "supabase",
      reason:
        env.VERCEL === "1" ? "vercel-force-supabase" : "production-force-supabase",
      legacyAllowed: false,
    };
  }

  if (explicit === "supabase") {
    return {
      provider: "supabase",
      reason: "explicit-supabase",
      legacyAllowed: false,
    };
  }

  if (explicit === "legacy") {
    // Explicit provider=legacy is the local allow flag; SPIORA_ALLOW_LEGACY_AUTH reinforces it.
    return {
      provider: "legacy",
      reason: "explicit-legacy",
      legacyAllowed: true,
    };
  }

  // Local default: keep demo JWT login working until cutover.
  // No silent fallback once supabase is selected.
  if (allowLegacyFlag || !explicit) {
    return {
      provider: "legacy",
      reason: "local-default-legacy",
      legacyAllowed: true,
    };
  }

  return {
    provider: "supabase",
    reason: "local-default-supabase",
    legacyAllowed: false,
  };
}

export function getAuthProvider(env: NodeJS.ProcessEnv = process.env): AuthProvider {
  return resolveAuthProvider(env).provider;
}

export function isLegacyAuthAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveAuthProvider(env).legacyAllowed;
}

export function isSupabaseAuthMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAuthProvider(env) === "supabase";
}
