/**
 * PWA / installed-app icon badge (Badging API).
 * Works for installed PWAs on Chromium (desktop + Android).
 * Does not work for plain .lnk browser shortcuts.
 */

export function canUseAppBadge(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.setAppBadge === "function"
  );
}

export async function setAppUnreadBadge(count: number): Promise<void> {
  const safe = Math.max(0, Math.floor(count));

  if (canUseAppBadge()) {
    try {
      if (safe <= 0) {
        await navigator.clearAppBadge?.();
      } else {
        await navigator.setAppBadge(safe);
      }
    } catch {
      // Unsupported or permission denied — ignore.
    }
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({
        type: "SPIORA_SET_BADGE",
        count: safe,
      });
    } catch {
      // ignore
    }
  }
}

export async function clearAppUnreadBadge(): Promise<void> {
  await setAppUnreadBadge(0);
}
