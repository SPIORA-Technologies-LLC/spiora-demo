import "server-only";

import type { LoginRateLimitResult } from "./login-rate-limit";
import { checkProductionSafeLoginRateLimit } from "./login-rate-limit-store";

/** Reuse persistent login limiter with namespaced keys for password flows. */
export async function checkPasswordFlowRateLimit(
  namespace: "forgot" | "change" | "reset" | "mfa-challenge" | "mfa-recovery" | "mfa-enroll",
  emailOrSub: string,
  ip?: string,
): Promise<LoginRateLimitResult> {
  return checkProductionSafeLoginRateLimit(
    `${namespace}:${emailOrSub.trim().toLowerCase()}`,
    ip,
  );
}

export async function checkPasswordIpRateLimit(
  namespace: "forgot-ip" | "reset-ip" | "oauth-ip" | "mfa-ip",
  ip?: string,
): Promise<LoginRateLimitResult> {
  return checkProductionSafeLoginRateLimit(`${namespace}:all`, ip);
}
