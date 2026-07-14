let mobileNavIntroDismissed = false;

export function isMobileNavIntroDismissed(): boolean {
  return mobileNavIntroDismissed;
}

export function dismissMobileNavIntro(): void {
  mobileNavIntroDismissed = true;
}

export function resetMobileNavIntro(): void {
  mobileNavIntroDismissed = false;
}
