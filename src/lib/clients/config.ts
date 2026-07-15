import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";

/** CRM reads/writes PostgreSQL when Supabase is configured and enabled by policy. */
export function isCrmPostgresPrimary(): boolean {
  return isSupabaseConfigured();
}

/**
 * Explicit local-dev fallback to legacy demo/Sheets paths.
 * Never enabled on Vercel. Never silent.
 */
export function isCrmLegacyFallbackAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.VERCEL === "1") return false;
  return env.SPIORA_CRM_LEGACY_FALLBACK?.trim().toLowerCase() === "true";
}

export type CrmDataSource = "postgresql" | "google_sheets" | "demo";

export function resolveCrmDataSource(): CrmDataSource {
  if (isCrmPostgresPrimary()) return "postgresql";
  return "demo";
}
