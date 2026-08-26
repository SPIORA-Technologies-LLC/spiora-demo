import { getNotificationDisplayMessage } from "@/lib/notifications/navigation";
import type { NotificationItem } from "@/components/notifications/notification-context";

const PERMISSION_PROMPTED_KEY = "spiora.notification-permission-prompted.v1";
const DEFAULT_AUTO_CLOSE_MS = 8_000;
const SW_READY_TIMEOUT_MS = 700;

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/** Soft-ask once after user gesture / first unread while app is open. */
export async function ensureBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(PERMISSION_PROMPTED_KEY) === "1") {
        return Notification.permission;
      }
    }
  } catch {
    // ignore
  }

  return requestBrowserNotificationPermission();
}

/** Explicit user action (settings / bell) — always opens the browser prompt when possible. */
export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PERMISSION_PROMPTED_KEY, "1");
    }
  } catch {
    // ignore
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** App covered by another window, minimized, or tab in background. */
export function isAppInBackground(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return true;
  try {
    return typeof document.hasFocus === "function" ? !document.hasFocus() : false;
  } catch {
    return false;
  }
}

export type SystemNotifyPayload = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
  /** Auto-close the toast; 0 = leave until user dismisses (Telegram-style). */
  autoCloseMs?: number;
};

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const ready = navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (reg?.active) return reg;
      return navigator.serviceWorker.ready;
    });
    const timedOut = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS);
    });
    return await Promise.race([ready, timedOut]);
  } catch {
    return null;
  }
}

async function closeNotificationByTag(tag: string): Promise<void> {
  try {
    const registration = await getServiceWorkerRegistration();
    if (registration) {
      const notes = await registration.getNotifications({ tag });
      for (const note of notes) {
        note.close();
      }
    }
  } catch {
    // ignore
  }
}

function buildNotificationOptions(
  payload: SystemNotifyPayload,
  tag: string,
  data: { url: string; notificationId: string },
): NotificationOptions & { renotify?: boolean } {
  return {
    body: payload.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag,
    // Chromium-only; triggers OS sound again for same tag.
    renotify: true,
    requireInteraction: false,
    silent: false,
    data,
  };
}

export async function showSystemNotification(
  payload: SystemNotifyPayload,
): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const tag = payload.tag ?? `spiora-${payload.id}`;
  const data = {
    url: payload.href || "/",
    notificationId: payload.id,
  };
  const autoCloseMs =
    payload.autoCloseMs === undefined
      ? DEFAULT_AUTO_CLOSE_MS
      : payload.autoCloseMs;
  const options = buildNotificationOptions(payload, tag, data);

  const registration = await getServiceWorkerRegistration();
  if (registration) {
    try {
      await registration.showNotification(payload.title, options);
      if (autoCloseMs > 0) {
        window.setTimeout(() => {
          void closeNotificationByTag(tag);
        }, autoCloseMs);
      }
      return true;
    } catch {
      // fall through to window Notification
    }
  }

  try {
    const n = new Notification(payload.title, options);
    n.onclick = () => {
      window.focus();
      if (payload.href) {
        window.location.href = payload.href;
      }
      n.close();
    };
    if (autoCloseMs > 0) {
      window.setTimeout(() => n.close(), autoCloseMs);
    }
    return true;
  } catch {
    return false;
  }
}

export function buildSystemNotifyFromItem(
  item: NotificationItem,
  href: string | null,
): SystemNotifyPayload {
  const display = getNotificationDisplayMessage(item.type, item.message);
  const isChat = item.type === "team_chat";

  return {
    id: item.id,
    title: isChat
      ? item.author_name?.trim() || item.title
      : item.title,
    body: isChat
      ? display
      : item.author_name
        ? `${item.author_name}: ${display}`
        : display,
    href,
    tag: `spiora-notif-${item.id}`,
    // Chat: leave on screen like Telegram until the user dismisses.
    autoCloseMs: isChat ? 0 : DEFAULT_AUTO_CLOSE_MS,
  };
}
