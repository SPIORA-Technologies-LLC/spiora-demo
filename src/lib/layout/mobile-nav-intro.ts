let mobileNavIntroDismissed = false;
let mobileNavPageEnter = false;

export function isMobileNavIntroDismissed(): boolean {
  return mobileNavIntroDismissed;
}

export function dismissMobileNavIntro(): void {
  mobileNavIntroDismissed = true;
}

export function resetMobileNavIntro(): void {
  mobileNavIntroDismissed = false;
  mobileNavPageEnter = false;
}

export function markMobileNavPageEnter(): void {
  mobileNavPageEnter = true;
}

export function consumeMobileNavPageEnter(): boolean {
  if (!mobileNavPageEnter) {
    return false;
  }
  mobileNavPageEnter = false;
  return true;
}
