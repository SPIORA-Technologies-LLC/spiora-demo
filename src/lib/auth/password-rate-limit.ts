import "server-only";

import {
  checkProductionSafeLoginRateLimit,
  type LoginRateLimitResult,
} from "./login-rate-limit-store";

/** Reuse persistent login limiter with namespaced keys for password flows. */
export async function checkPasswordFlowRateLimit(
  namespace: "forgot" | "change" | "reset",
  emailOrSub: string,
  ip?: string,
): Promise<LoginRateLimitResult> {
  return checkProductionSafeLoginRateLimit(
    `${namespace}:${emailOrSub.trim().toLowerCase()}`,
    ip,
  );
}

export async function checkPasswordIpRateLimit(
  namespace: "forgot-ip" | "reset-ip",
  ip?: string,
): Promise<LoginRateLimitResult> {
  return checkProductionSafeLoginRateLimit(`${namespace}:all`, ip);
}
