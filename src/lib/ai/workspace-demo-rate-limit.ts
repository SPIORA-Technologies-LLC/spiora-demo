import type { AppLocale } from "@/i18n/config";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";
import { isDemoMode } from "@/lib/demo/demo-mode";

export const DEMO_MAX_PROMPT_LENGTH = 2000;
export const DEMO_MAX_HISTORY_TURNS = 8;
export const DEMO_MAX_REQUESTS_PER_USER = 120;
export const DEMO_MAX_REQUESTS_PER_MINUTE = 12;

type UserRateState = {
  total: number;
  minuteWindowStart: number;
  minuteCount: number;
};

const userRates = new Map<string, UserRateState>();

function getUserState(userId: string): UserRateState {
  const existing = userRates.get(userId);
  if (existing) return existing;
  const created: UserRateState = {
    total: 0,
    minuteWindowStart: Date.now(),
    minuteCount: 0,
  };
  userRates.set(userId, created);
  return created;
}

export type DemoRateLimitResult =
  | { allowed: true }
  | { allowed: false; message: string; reason: "total" | "minute" | "prompt" | "history" };

export function checkDemoRateLimit(
  userId: string,
  locale: AppLocale,
  options: {
    promptLength: number;
    historyTurns: number;
  },
): DemoRateLimitResult {
  if (!isDemoMode()) {
    return { allowed: true };
  }

  if (options.promptLength > DEMO_MAX_PROMPT_LENGTH) {
    return {
      allowed: false,
      reason: "prompt",
      message: translateWorkspaceMessage(locale, "limits.promptTooLong"),
    };
  }

  if (options.historyTurns > DEMO_MAX_HISTORY_TURNS) {
    return {
      allowed: false,
      reason: "history",
      message: translateWorkspaceMessage(locale, "limits.historyTooLong"),
    };
  }

  const state = getUserState(userId);
  const now = Date.now();

  if (now - state.minuteWindowStart >= 60_000) {
    state.minuteWindowStart = now;
    state.minuteCount = 0;
  }

  if (state.minuteCount >= DEMO_MAX_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      reason: "minute",
      message: translateWorkspaceMessage(locale, "limits.ratePerMinute"),
    };
  }

  if (state.total >= DEMO_MAX_REQUESTS_PER_USER) {
    return {
      allowed: false,
      reason: "total",
      message: translateWorkspaceMessage(locale, "limits.ratePerUser"),
    };
  }

  state.minuteCount += 1;
  state.total += 1;
  return { allowed: true };
}

/** Test helper — reset in-memory counters. */
export function resetDemoRateLimitsForTests(): void {
  userRates.clear();
}

/** Test helper — advance minute window for a user. */
export function advanceDemoRateLimitMinuteForTests(userId: string): void {
  const state = getUserState(userId);
  state.minuteWindowStart = Date.now() - 60_001;
  state.minuteCount = 0;
}
