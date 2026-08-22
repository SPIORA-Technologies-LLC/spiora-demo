import "server-only";

import type { CompanyDetailsStore } from "./store";

export type CompanyDetailsStoreMode = "supabase" | "demo";

export function resolveCompanyDetailsStoreMode(
  env: NodeJS.ProcessEnv = process.env,
): CompanyDetailsStoreMode {
  const explicit = env.COMPANY_DETAILS_STORE_MODE?.trim().toLowerCase();
  const nodeEnv = env.NODE_ENV;

  if (nodeEnv === "production" && explicit === "demo") {
    throw new Error(
      "COMPANY_DETAILS_STORE_MODE=demo is forbidden in production. Use PostgreSQL store.",
    );
  }

  if (explicit === "demo") return "demo";
  if (explicit === "supabase") return "supabase";

  if (env.VITEST === "true" || env.NODE_ENV === "test") {
    return "demo";
  }

  return "supabase";
}

let cached: CompanyDetailsStore | null = null;
let cachedMode: CompanyDetailsStoreMode | null = null;

export function resetCompanyDetailsStoreCacheForTests(): void {
  cached = null;
  cachedMode = null;
}

export async function getCompanyDetailsStore(): Promise<CompanyDetailsStore> {
  const mode = resolveCompanyDetailsStoreMode();

  if (cached && cachedMode === mode) {
    return cached;
  }

  if (mode === "demo") {
    const { createDemoCompanyDetailsStore } = await import(
      "./demo-company-details-store"
    );
    cached = createDemoCompanyDetailsStore();
    cachedMode = mode;
    return cached;
  }

  const { isSupabaseConfigured } = await import("@/lib/supabase/config");
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Company details store requires Supabase configuration (fail-closed). Set COMPANY_DETAILS_STORE_MODE=demo only for local non-production.",
    );
  }

  const { createSupabaseCompanyDetailsStore } = await import(
    "./supabase-company-details-store"
  );
  cached = createSupabaseCompanyDetailsStore();
  cachedMode = mode;
  return cached;
}

export async function resetCompanyDetailsStoreForTests(): Promise<void> {
  resetCompanyDetailsStoreCacheForTests();
  const store = await getCompanyDetailsStore();
  await store.resetForTests?.();
}
