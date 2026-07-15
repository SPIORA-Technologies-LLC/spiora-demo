import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  areGoogleIntegrationsEnabled,
  isExternalAiIntegrationEnabled,
  isSupabaseIntegrationEnabled,
} from "@/lib/demo/integration-policy";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type HealthStatus =
  | "ok"
  | "degraded"
  | "error"
  | "disabled"
  | "unavailable";

export type SystemHealthReport = {
  postgresql: HealthStatus;
  storage: HealthStatus;
  auth: HealthStatus;
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

function isAuthConfigured(): boolean {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return true;
  return process.env.NODE_ENV !== "production";
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

function probeAuth(): HealthStatus {
  return isAuthConfigured() ? "ok" : "error";
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
  const [postgresql, storage] = await Promise.all([
    probePostgresql(),
    probeStorage(),
  ]);

  return {
    postgresql,
    storage,
    auth: probeAuth(),
    google: probeGoogle(),
    ai: probeAi(),
    version: readAppVersion(),
  };
}
