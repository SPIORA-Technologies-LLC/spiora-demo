import { getNotificationDisplayMessage } from "@/lib/notifications/navigation";
import type { NotificationItem } from "@/components/notifications/notification-context";

const PERMISSION_PROMPTED_KEY = "spiora.notification-permission-prompted.v1";

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/** Soft-ask once after user gesture / first unread while app is open. */
export async function ensureBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(PERMISSION_PROMPTED_KEY) === "1") {
        return Notification.permission;
      }
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

export type SystemNotifyPayload = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
};

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

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag,
        renotify: true,
        data,
      });
      return true;
    }
  } catch {
    // fall through to window Notification
  }

  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192x192.png",
      tag,
      data,
    });
    n.onclick = () => {
      window.focus();
      if (payload.href) {
        window.location.href = payload.href;
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function buildSystemNotifyFromItem(
  item: NotificationItem,
  href: string | null,
): SystemNotifyPayload {
  return {
    id: item.id,
    title: item.title,
    body: getNotificationDisplayMessage(item.type, item.message),
    href,
    tag: `spiora-notif-${item.id}`,
  };
}
