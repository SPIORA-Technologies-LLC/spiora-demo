/**
 * Client-only persistence for employee MFA onboarding dismiss (Phase C.2).
 * Does not affect MFA security, enroll, challenge, or feature flags.
 */

export const EMPLOYEE_MFA_ONBOARDING_STORAGE_PREFIX =
  "spiora.employee.mfa.onboarding.v1:";

export function employeeMfaOnboardingStorageKey(userId: string): string {
  return `${EMPLOYEE_MFA_ONBOARDING_STORAGE_PREFIX}${userId.trim()}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSeenEmployeeMfaOnboarding(
  userId: string,
  storage?: StorageLike,
): boolean {
  const id = userId.trim();
  if (!id) return true;
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    return store.getItem(employeeMfaOnboardingStorageKey(id)) === "1";
  } catch {
    return false;
  }
}

export function markEmployeeMfaOnboardingSeen(
  userId: string,
  storage?: StorageLike,
): void {
  const id = userId.trim();
  if (!id) return;
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(employeeMfaOnboardingStorageKey(id), "1");
  } catch {
    // private mode / quota — best-effort
  }
}
