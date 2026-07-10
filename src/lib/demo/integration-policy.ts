import { isDemoMode, isTruthyEnv } from "./demo-mode";

/** Supabase persistence — off in demo until SPIORA_ENABLE_SUPABASE=true. */
export function isSupabaseIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_SUPABASE?.trim().toLowerCase() === "true";
}

/** Google Sheets / Drive — off in demo until explicitly enabled. */
export function areGoogleIntegrationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_GOOGLE_INTEGRATIONS?.trim().toLowerCase() === "true";
}

/** LiveKit video — off in demo until explicitly enabled. */
export function isLiveKitIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_LIVEKIT?.trim().toLowerCase() === "true";
}

/** OpenRouter / OpenAI — off in demo until explicitly enabled. */
export function isExternalAiIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_EXTERNAL_AI?.trim().toLowerCase() === "true";
}

/** Emigrant Desk Supabase — off in demo until explicitly enabled. */
export function isEmigrantDeskIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_EMIGRANT_DESK?.trim().toLowerCase() === "true";
}

/** Calendar reminder cron endpoint. */
export function isCronIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_CRON?.trim().toLowerCase() === "true";
}

/** Inbound webhooks (LiveKit egress, etc.). */
export function areWebhooksIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") return true;
  return env.SPIORA_ENABLE_WEBHOOKS?.trim().toLowerCase() === "true";
}

/** Convenience wrappers without explicit env (runtime). */
export function isSupabaseEnabled(): boolean {
  return isSupabaseIntegrationEnabled();
}

export function isGoogleEnabled(): boolean {
  return areGoogleIntegrationsEnabled();
}

export function isLiveKitEnabled(): boolean {
  return isLiveKitIntegrationEnabled();
}

export function isExternalAiEnabled(): boolean {
  return isExternalAiIntegrationEnabled();
}

export function isEmigrantDeskEnabled(): boolean {
  return isEmigrantDeskIntegrationEnabled();
}

export function isCronEnabled(): boolean {
  return isCronIntegrationEnabled();
}

export function areWebhooksEnabled(): boolean {
  return areWebhooksIntegrationEnabled();
}

export { isDemoMode, isTruthyEnv };
