import { isDemoModeFromEnv } from "@/lib/demo/environment-guard";
import { isSupabaseIntegrationEnabled } from "@/lib/demo/integration-policy";

type EnvRecord = Record<string, string | undefined>;

export function isSupabaseConfiguredFromEnv(
  env: EnvRecord = process.env as EnvRecord,
): boolean {
  if (!isSupabaseIntegrationEnabled(env as NodeJS.ProcessEnv)) {
    return false;
  }

  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function isClientPortalDemoAuthEnabledFromEnv(
  env: EnvRecord = process.env as EnvRecord,
): boolean {
  return isDemoModeFromEnv(env) && isSupabaseConfiguredFromEnv(env);
}

export function resolveClientAuthConfigFromEnv(
  env: EnvRecord = process.env as EnvRecord,
) {
  return {
    skipEmailConfirmation: isClientPortalDemoAuthEnabledFromEnv(env),
  };
}

export function evaluateDemoRegisterAccess(
  env: EnvRecord = process.env as EnvRecord,
): "allowed" | "forbidden" {
  return isClientPortalDemoAuthEnabledFromEnv(env) ? "allowed" : "forbidden";
}
