export const MOBILE_NAV_INTRO_KEY = "spiora-mobile-nav-intro-seen";

export function clearMobileNavIntroSeen(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(MOBILE_NAV_INTRO_KEY);
}

export function markMobileNavIntroSeen(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MOBILE_NAV_INTRO_KEY, "1");
}

export function hasSeenMobileNavIntro(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(MOBILE_NAV_INTRO_KEY) === "1";
}
