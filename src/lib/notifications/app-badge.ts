/**
 * PWA / installed-app icon badge (Badging API).
 * Works for installed PWAs on Chromium/Edge (desktop).
 * Does not work for plain .lnk browser shortcuts.
 *
 * Also mirrors unread into the document title — kept sticky against Next.js
 * metadata resets via a MutationObserver.
 */

const TITLE_BADGE_RE = /^\(\d+\)\s+/;

let notificationsUnread = 0;
let teamChatUnread = 0;
let titleObserver: MutationObserver | null = null;
let titleWatchStarted = false;

export function canUseAppBadge(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.setAppBadge === "function"
  );
}

function combinedUnread(): number {
  return Math.max(
    Math.max(0, Math.floor(notificationsUnread)),
    Math.max(0, Math.floor(teamChatUnread)),
  );
}

function syncDocumentTitleBadge(count: number): void {
  if (typeof document === "undefined") return;
  const raw = document.title.replace(TITLE_BADGE_RE, "").trim();
  const base = raw || "Spiora";
  const next = count > 0 ? `(${count}) ${base}` : base;
  if (document.title !== next) {
    document.title = next;
  }
}

function ensureTitleWatch(): void {
  if (typeof document === "undefined" || titleWatchStarted) return;
  titleWatchStarted = true;

  const attach = () => {
    const titleEl = document.querySelector("title");
    if (!titleEl || titleObserver) return;
    titleObserver = new MutationObserver(() => {
      syncDocumentTitleBadge(combinedUnread());
    });
    titleObserver.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  attach();
  // Title node can be replaced by the framework after navigation.
  window.setInterval(attach, 2000);
}

async function applyBadge(count: number): Promise<void> {
  const safe = Math.max(0, Math.floor(count));
  ensureTitleWatch();
  syncDocumentTitleBadge(safe);

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
      // Keep SW alive until Windows/Edge receives the badge update.
      const active = registration.active;
      if (active) {
        active.postMessage({
          type: "SPIORA_SET_BADGE",
          count: safe,
        });
      }
      if (typeof registration.setAppBadge === "function") {
        if (safe <= 0) {
          await registration.clearAppBadge?.();
        } else {
          await registration.setAppBadge(safe);
        }
      }
    } catch {
      // ignore
    }
  }
}

/** Bell / notifications table unread. */
export async function setNotificationsUnreadForBadge(
  count: number,
): Promise<void> {
  notificationsUnread = Math.max(0, Math.floor(count));
  await applyBadge(combinedUnread());
}

/** Team chat sidebar unread (covers lag before notification rows arrive). */
export async function setTeamChatUnreadForBadge(count: number): Promise<void> {
  teamChatUnread = Math.max(0, Math.floor(count));
  await applyBadge(combinedUnread());
}

/** @deprecated Prefer setNotificationsUnreadForBadge / setTeamChatUnreadForBadge */
export async function setAppUnreadBadge(count: number): Promise<void> {
  await setNotificationsUnreadForBadge(count);
}

export async function clearAppUnreadBadge(): Promise<void> {
  notificationsUnread = 0;
  teamChatUnread = 0;
  await applyBadge(0);
}

/** Manual QA from the bell panel. */
export async function forceAppBadgeForTest(count: number): Promise<boolean> {
  try {
    await applyBadge(count);
    return canUseAppBadge();
  } catch {
    return false;
  }
}
