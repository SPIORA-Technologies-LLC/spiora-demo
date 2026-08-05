import "server-only";

import { isClientPortalDemoAuthEnabledFromEnv } from "@/lib/client-portal/demo-auth-policy";
import { provisionClientPortalAuthUser } from "@/lib/client-portal/client-auth-provision";

/**
 * Demo-only: skip email confirmation for client portal registration.
 * Requires SPIORA_DEMO_MODE=true and Supabase (service role).
 * Never enabled in production without demo flag.
 */
export function isClientPortalDemoAuthEnabled(): boolean {
  return isClientPortalDemoAuthEnabledFromEnv();
}

export async function demoRegisterConfirmedClientUser(input: {
  email: string;
  password: string;
  firstName?: string | null;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!isClientPortalDemoAuthEnabled()) {
    return { ok: false, code: "DEMO_AUTH_DISABLED" };
  }

  const result = await provisionClientPortalAuthUser(input);
  if (!result.ok) {
    if (result.code === "INVALID_EMAIL" || result.code === "INVALID_CREDENTIALS") {
      return { ok: false, code: "INVALID_CREDENTIALS" };
    }
    return { ok: false, code: "REGISTRATION_FAILED" };
  }
  return { ok: true };
}
