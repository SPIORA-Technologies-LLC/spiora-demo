import type { AppLocale } from "@/i18n/config";
import { isDemoMode } from "@/lib/demo/demo-mode";

export const DEMO_MAX_CHAT_MESSAGE_LENGTH = 5000;
export const DEMO_MAX_MESSAGES_PER_MINUTE = 20;
export const DEMO_MAX_MESSAGES_PER_USER = 200;
export const DEMO_MAX_UPLOADS_PER_MINUTE = 8;
export const DEMO_MAX_DELETES_PER_MINUTE = 15;

export type TeamChatDemoAction = "send" | "upload" | "delete";

type UserRateState = {
  minuteWindowStart: number;
  sendMinuteCount: number;
  uploadMinuteCount: number;
  deleteMinuteCount: number;
  total: number;
};

const userRates = new Map<string, UserRateState>();

function getUserState(userId: string): UserRateState {
  const existing = userRates.get(userId);
  if (existing) return existing;
  const created: UserRateState = {
    minuteWindowStart: Date.now(),
    sendMinuteCount: 0,
    uploadMinuteCount: 0,
    deleteMinuteCount: 0,
    total: 0,
  };
  userRates.set(userId, created);
  return created;
}

function resetMinuteWindowIfNeeded(state: UserRateState, now: number): void {
  if (now - state.minuteWindowStart >= 60_000) {
    state.minuteWindowStart = now;
    state.sendMinuteCount = 0;
    state.uploadMinuteCount = 0;
    state.deleteMinuteCount = 0;
  }
}

export type TeamChatRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "minute" | "total" | "length";
    };

export function checkTeamChatDemoActionRateLimit(
  userId: string,
  action: TeamChatDemoAction,
  textLength: number,
): TeamChatRateLimitResult {
  if (!isDemoMode()) {
    return { allowed: true };
  }

  if (action === "send" && textLength > DEMO_MAX_CHAT_MESSAGE_LENGTH) {
    return { allowed: false, reason: "length" };
  }

  const state = getUserState(userId);
  const now = Date.now();
  resetMinuteWindowIfNeeded(state, now);

  if (action === "send") {
    if (state.sendMinuteCount >= DEMO_MAX_MESSAGES_PER_MINUTE) {
      return { allowed: false, reason: "minute" };
    }
    if (state.total >= DEMO_MAX_MESSAGES_PER_USER) {
      return { allowed: false, reason: "total" };
    }
    state.sendMinuteCount += 1;
    state.total += 1;
    return { allowed: true };
  }

  if (action === "upload") {
    if (state.uploadMinuteCount >= DEMO_MAX_UPLOADS_PER_MINUTE) {
      return { allowed: false, reason: "minute" };
    }
    state.uploadMinuteCount += 1;
    return { allowed: true };
  }

  if (state.deleteMinuteCount >= DEMO_MAX_DELETES_PER_MINUTE) {
    return { allowed: false, reason: "minute" };
  }
  state.deleteMinuteCount += 1;
  return { allowed: true };
}

/** @deprecated Use checkTeamChatDemoActionRateLimit("send", ...) */
export function checkTeamChatDemoRateLimit(
  userId: string,
  textLength: number,
): TeamChatRateLimitResult {
  return checkTeamChatDemoActionRateLimit(userId, "send", textLength);
}

export function resetTeamChatDemoRateLimitsForTests(): void {
  userRates.clear();
}
