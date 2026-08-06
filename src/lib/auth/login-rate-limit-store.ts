import "server-only";

import {
  LOGIN_BLOCK_MS,
  LOGIN_MAX_ATTEMPTS_PER_MINUTE,
  type LoginRateLimitResult,
} from "./login-rate-limit";

export type { LoginRateLimitResult };

export type LoginRateLimiter = {
  check(email: string, ip?: string): Promise<LoginRateLimitResult>;
};

type RateRow = {
  rate_key: string;
  window_start: string;
  attempts: number;
  blocked_until: string | null;
};

function getKey(email: string, ip?: string): string {
  return `${email.trim().toLowerCase()}:${ip?.trim() || "unknown"}`;
}

/**
 * In-memory limiter — local/dev fallback only.
 * Not sufficient alone on multi-instance Vercel.
 */
const memoryStates = new Map<
  string,
  { windowStart: number; attempts: number; blockedUntil: number }
>();

export function createMemoryLoginRateLimiter(): LoginRateLimiter {
  return {
    async check(email, ip) {
      const key = getKey(email, ip);
      const now = Date.now();
      const state = memoryStates.get(key) ?? {
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
        memoryStates.set(key, state);
        return { allowed: false, retryAfterMs: LOGIN_BLOCK_MS };
      }

      state.attempts += 1;
      memoryStates.set(key, state);
      return { allowed: true };
    },
  };
}

/**
 * Persistent limiter backed by auth_login_rate_limits (Supabase/PostgreSQL).
 * Safe for Vercel multi-instance when Supabase is configured.
 */
export function createPersistentLoginRateLimiter(): LoginRateLimiter {
  return {
    async check(email, ip) {
      const { isSupabaseConfigured } = await import("@/lib/supabase/config");
      if (!isSupabaseConfigured()) {
        return createMemoryLoginRateLimiter().check(email, ip);
      }

      const { getSupabaseAdmin } = await import("@/lib/supabase/server");
      const supabase = getSupabaseAdmin();
      const key = getKey(email, ip);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      const { data, error } = await supabase
        .from("auth_login_rate_limits")
        .select("rate_key, window_start, attempts, blocked_until")
        .eq("rate_key", key)
        .maybeSingle();

      if (error) {
        // Fail closed would lock everyone out on DB blip; degrade to memory.
        console.error("[auth/rate-limit] persistent read failed");
        return createMemoryLoginRateLimiter().check(email, ip);
      }

      let windowStart = now;
      let attempts = 0;
      let blockedUntil = 0;

      if (data) {
        const row = data as RateRow;
        windowStart = new Date(row.window_start).getTime();
        attempts = row.attempts;
        blockedUntil = row.blocked_until
          ? new Date(row.blocked_until).getTime()
          : 0;
      }

      if (blockedUntil > now) {
        return { allowed: false, retryAfterMs: blockedUntil - now };
      }

      if (now - windowStart >= LOGIN_BLOCK_MS) {
        windowStart = now;
        attempts = 0;
        blockedUntil = 0;
      }

      if (attempts >= LOGIN_MAX_ATTEMPTS_PER_MINUTE) {
        blockedUntil = now + LOGIN_BLOCK_MS;
        await supabase.from("auth_login_rate_limits").upsert(
          {
            rate_key: key,
            window_start: new Date(windowStart).toISOString(),
            attempts,
            blocked_until: new Date(blockedUntil).toISOString(),
            updated_at: nowIso,
          },
          { onConflict: "rate_key" },
        );
        return { allowed: false, retryAfterMs: LOGIN_BLOCK_MS };
      }

      attempts += 1;
      await supabase.from("auth_login_rate_limits").upsert(
        {
          rate_key: key,
          window_start: new Date(windowStart).toISOString(),
          attempts,
          blocked_until: null,
          updated_at: nowIso,
        },
        { onConflict: "rate_key" },
      );

      return { allowed: true };
    },
  };
}

let sharedLimiter: LoginRateLimiter | null = null;

export function getLoginRateLimiter(): LoginRateLimiter {
  if (!sharedLimiter) {
    sharedLimiter = createPersistentLoginRateLimiter();
  }
  return sharedLimiter;
}

export function resetPersistentLoginRateLimiterForTests(): void {
  sharedLimiter = null;
  memoryStates.clear();
}

export async function checkProductionSafeLoginRateLimit(
  email: string,
  ip?: string,
): Promise<LoginRateLimitResult> {
  // Always enforce — not demo-only.
  return getLoginRateLimiter().check(email, ip);
}
