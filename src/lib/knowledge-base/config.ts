import "server-only";

import { isSupabaseIntegrationEnabled } from "@/lib/demo/integration-policy";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Primary KB store is PostgreSQL when Supabase CRM is enabled. */
export function isKnowledgeBasePostgresEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isSupabaseIntegrationEnabled(env)) return false;
  if (!isSupabaseConfigured()) return false;
  return envFlag("SPIORA_KB_POSTGRES", true);
}

/**
 * Embedded i18n fallback (no .data file). Default true in demo until
 * SPIORA_KB_EMBEDDED_FALLBACK=false after runtime validation on Vercel.
 */
export function isKnowledgeBaseEmbeddedFallbackEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!envFlag("SPIORA_KB_EMBEDDED_FALLBACK", true)) return false;
  return env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true";
}

export function shouldPreferEmbeddedKnowledgeBase(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    !isKnowledgeBasePostgresEnabled(env) &&
    isKnowledgeBaseEmbeddedFallbackEnabled(env)
  );
}
