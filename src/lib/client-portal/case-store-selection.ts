import "server-only";

import { isSupabaseIntegrationEnabled } from "@/lib/demo/integration-policy";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  CaseStoreConfigurationError,
  isProductionLikeRuntime,
  type CaseStore,
} from "./case-store";
import { createLocalCaseStore } from "./case-local-store";
import { createSupabaseCaseStore } from "./case-supabase-store";

let storePromise: Promise<CaseStore> | null = null;

function hasSupabaseCredentials(env: NodeJS.ProcessEnv): boolean {
  if (!isSupabaseIntegrationEnabled(env)) return false;
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/**
 * Production: Supabase only. Local JSON only in development/test.
 * Never silently falls back to .data in production/Vercel.
 */
export function resolveCaseStoreBackend(
  env: NodeJS.ProcessEnv = process.env,
): "supabase" | "local" {
  if (hasSupabaseCredentials(env)) return "supabase";
  if (isProductionLikeRuntime(env)) {
    throw new CaseStoreConfigurationError(
      "Case store requires Supabase in production (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Local JSON fallback is disabled.",
    );
  }
  return "local";
}

export async function getCaseStore(): Promise<CaseStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const backend = resolveCaseStoreBackend();
      if (backend === "supabase") {
        return createSupabaseCaseStore(getSupabaseAdmin());
      }
      return createLocalCaseStore();
    })();
  }
  return storePromise;
}

/** Test helper — clears memoized store selection. */
export function resetCaseStoreForTests(): void {
  storePromise = null;
}
