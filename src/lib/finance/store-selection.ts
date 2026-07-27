import "server-only";

import type { FinanceStore } from "./store";

export type FinanceStoreMode = "supabase" | "demo";

export function resolveFinanceStoreMode(
  env: NodeJS.ProcessEnv = process.env,
): FinanceStoreMode {
  const explicit = env.FINANCE_STORE_MODE?.trim().toLowerCase();
  const nodeEnv = env.NODE_ENV;

  if (nodeEnv === "production" && explicit === "demo") {
    throw new Error(
      "FINANCE_STORE_MODE=demo is forbidden in production. Use PostgreSQL Finance store.",
    );
  }

  if (explicit === "demo") return "demo";
  if (explicit === "supabase") return "supabase";

  // Tests default to demo unless explicitly forced to supabase.
  if (env.VITEST === "true" || env.NODE_ENV === "test") {
    return "demo";
  }

  return "supabase";
}

let cached: FinanceStore | null = null;
let cachedMode: FinanceStoreMode | null = null;

export function resetFinanceStoreCacheForTests(): void {
  cached = null;
  cachedMode = null;
}

export async function getFinanceStore(): Promise<FinanceStore> {
  const mode = resolveFinanceStoreMode();

  if (cached && cachedMode === mode) {
    return cached;
  }

  if (mode === "demo") {
    const { createDemoFinanceStore } = await import("./demo-finance-store");
    cached = createDemoFinanceStore();
    cachedMode = mode;
    return cached;
  }

  const { isSupabaseConfigured } = await import("@/lib/supabase/config");
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Finance store requires Supabase configuration (fail-closed). Set FINANCE_STORE_MODE=demo only for local non-production.",
    );
  }

  const { createSupabaseFinanceStore } = await import("./supabase-finance-store");
  cached = createSupabaseFinanceStore();
  cachedMode = mode;
  return cached;
}
