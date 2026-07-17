import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  areGoogleIntegrationsEnabled,
  isExternalAiIntegrationEnabled,
  isSupabaseIntegrationEnabled,
} from "@/lib/demo/integration-policy";
import {
  isSupabaseAuthConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import {
  getAuthProvider,
  resolveAuthProvider,
  type AuthProvider,
} from "@/lib/auth/provider";

export type HealthStatus =
  | "ok"
  | "warning"
  | "degraded"
  | "error"
  | "disabled"
  | "unavailable";

export type RlsHealthStatus = "enabled" | "disabled" | "warning";

export type SystemHealthReport = {
  postgresql: HealthStatus;
  storage: HealthStatus;
  authProvider: AuthProvider;
  auth: HealthStatus;
  profiles: HealthStatus;
  session: HealthStatus;
  rbac: HealthStatus;
  /** Phase 1 RLS surface status. Never includes policy names or SQL. */
  rls: RlsHealthStatus;
  rlsPhase: "phase1";
  google: HealthStatus;
  ai: HealthStatus;
  version: string;
};

function readAppVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version?.trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function isLegacyAuthSecretConfigured(): boolean {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return true;
  return process.env.NODE_ENV !== "production";
}

function usesDevFallbackAuthSecret(): boolean {
  return !process.env.AUTH_SECRET?.trim() && process.env.NODE_ENV !== "production";
}

async function probePostgresql(): Promise<HealthStatus> {
  if (!isSupabaseIntegrationEnabled()) return "disabled";
  if (!isSupabaseConfigured()) return "unavailable";

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { error } = await getSupabaseAdmin()
      .from("app_state")
      .select("key", { count: "exact", head: true })
      .limit(1);

    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

async function probeStorage(): Promise<HealthStatus> {
  if (!isSupabaseIntegrationEnabled()) return "disabled";
  if (!isSupabaseConfigured()) return "unavailable";

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { error } = await getSupabaseAdmin().storage.listBuckets();
    return error ? "degraded" : "ok";
  } catch {
    return "error";
  }
}

function probeAuth(provider: AuthProvider): HealthStatus {
  if (provider === "supabase") {
    if (!isSupabaseAuthConfigured()) return "disabled";
    if (!isSupabaseConfigured()) return "warning";
    return "ok";
  }

  if (!isLegacyAuthSecretConfigured()) return "disabled";
  return usesDevFallbackAuthSecret() ? "warning" : "ok";
}

async function probeProfiles(provider: AuthProvider): Promise<HealthStatus> {
  if (provider !== "supabase") return "disabled";
  if (!isSupabaseConfigured()) return "unavailable";

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { error } = await getSupabaseAdmin()
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      // Table may not exist yet before migration 024 is applied.
      return "unavailable";
    }
    return "ok";
  } catch {
    return "error";
  }
}

function probeSession(provider: AuthProvider): HealthStatus {
  if (provider === "supabase") {
    if (!isSupabaseAuthConfigured()) return "disabled";
    return "ok";
  }

  if (!isLegacyAuthSecretConfigured()) return "disabled";
  // Legacy JWT: no refresh/revocation.
  return "warning";
}

function probeRbac(): HealthStatus {
  return "warning";
}

async function probeRls(): Promise<RlsHealthStatus> {
  if (!isSupabaseIntegrationEnabled()) return "disabled";
  if (!isSupabaseConfigured()) return "disabled";

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { data, error } = await getSupabaseAdmin().rpc(
      "spiora_rls_phase1_status",
    );

    if (error) {
      // Function missing until migration 025 is applied.
      return "disabled";
    }

    if (data === "enabled" || data === "disabled" || data === "warning") {
      return data;
    }
    return "warning";
  } catch {
    return "warning";
  }
}

function probeGoogle(): HealthStatus {
  if (!isSupabaseIntegrationEnabled() && !areGoogleIntegrationsEnabled()) {
    return "disabled";
  }
  if (!areGoogleIntegrationsEnabled()) return "disabled";

  const hasSheets = Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim());
  const hasSa = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_PRIVATE_KEY?.trim(),
  );

  if (hasSheets && hasSa) return "ok";
  if (hasSheets || hasSa) return "degraded";
  return "unavailable";
}

function probeAi(): HealthStatus {
  if (!isExternalAiIntegrationEnabled()) return "disabled";

  const hasKey = Boolean(
    process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );

  return hasKey ? "ok" : "unavailable";
}

export async function getSystemHealth(): Promise<SystemHealthReport> {
  const provider = getAuthProvider();
  const resolution = resolveAuthProvider();
  void resolution;

  const [postgresql, storage, profiles, rls] = await Promise.all([
    probePostgresql(),
    probeStorage(),
    probeProfiles(provider),
    probeRls(),
  ]);

  return {
    postgresql,
    storage,
    authProvider: provider,
    auth: probeAuth(provider),
    profiles,
    session: probeSession(provider),
    rbac: probeRbac(),
    rls,
    rlsPhase: "phase1",
    google: probeGoogle(),
    ai: probeAi(),
    version: readAppVersion(),
  };
}
