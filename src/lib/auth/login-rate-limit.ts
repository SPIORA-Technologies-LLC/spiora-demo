import { isDemoMode } from "@/lib/demo/demo-mode";

export const LOGIN_MAX_ATTEMPTS_PER_MINUTE = 5;
export const LOGIN_BLOCK_MS = 60_000;

type LoginRateState = {
  windowStart: number;
  attempts: number;
  blockedUntil: number;
};

const states = new Map<string, LoginRateState>();

function getKey(email: string, ip?: string): string {
  const normalized = email.trim().toLowerCase();
  return `${normalized}:${ip?.trim() || "unknown"}`;
}

export type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export function checkLoginRateLimit(
  email: string,
  ip?: string,
): LoginRateLimitResult {
  if (!isDemoMode()) {
    return { allowed: true };
  }

  const key = getKey(email, ip);
  const now = Date.now();
  const state = states.get(key) ?? {
    windowStart: now,
    attempts: 0,
    blockedUntil: 0,
  };

  if (state.blockedUntil > now) {
    return { allowed: false, retryAfterMs: state.blockedUntil - now };
  }

  if (now - state.windowStart >= LOGIN_BLOCK_MS) {
    state.windowStart = now;
    state.attempts = 0;
    state.blockedUntil = 0;
  }

  if (state.attempts >= LOGIN_MAX_ATTEMPTS_PER_MINUTE) {
    state.blockedUntil = now + LOGIN_BLOCK_MS;
    states.set(key, state);
    return { allowed: false, retryAfterMs: LOGIN_BLOCK_MS };
  }

  state.attempts += 1;
  states.set(key, state);
  return { allowed: true };
}

export function resetLoginRateLimitForTests(): void {
  states.clear();
}

export function advanceLoginRateLimitForTests(ms: number): void {
  const shift = ms;
  for (const state of states.values()) {
    state.windowStart -= shift;
    state.blockedUntil -= shift;
  }
}
