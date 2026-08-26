"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { TeamChatMessage } from "@/lib/team-chat/types";
import {
  getBrowserNotificationPermission,
  isAppInBackground,
  requestBrowserNotificationPermission,
  showSystemNotification,
} from "@/lib/notifications/system-notify";
import {
  isNotificationSoundEnabled,
  playNotificationSound,
  unlockNotificationAudio,
} from "@/lib/notifications/play-sound";
import styles from "./TeamChatDesktopAlerts.module.css";

const DISMISS_PERMISSION_KEY = "spiora.desktop-permission-banner-dismissed.v1";

function previewForMessage(message: TeamChatMessage, fallback: string): string {
  if (message.message_type === "voice") return fallback;
  if (message.message_type === "image") return "📷";
  if (message.message_type === "file") {
    return message.file_name?.trim() || "📎";
  }
  const text = message.message_text?.trim() || "";
  return text.length > 160 ? `${text.slice(0, 160)}…` : text || fallback;
}

/**
 * Telegram-style desktop alerts driven by team-chat unread count.
 * Works even when the notifications table poll is delayed or permission
 * was never granted for the in-app toast path.
 */
export function TeamChatDesktopAlerts() {
  const pathname = usePathname();
  const t = useTranslations("notifications");
  const prevUnreadRef = useRef<number | null>(null);
  const lastAlertedMessageIdRef = useRef<string | null>(null);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [showBanner, setShowBanner] = useState(false);

  const onTeamChat =
    pathname === "/team-chat" || pathname.startsWith("/team-chat/");

  useEffect(() => {
    setPermission(getBrowserNotificationPermission());
    try {
      const dismissed =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(DISMISS_PERMISSION_KEY) === "1";
      const current = getBrowserNotificationPermission();
      setShowBanner(!dismissed && current !== "granted" && current !== "unsupported");
    } catch {
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    if (onTeamChat) {
      prevUnreadRef.current = 0;
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    async function alertForLatestMessage() {
      try {
        const res = await fetch("/api/team-chat?limit=5");
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: TeamChatMessage[] };
        const list = data.messages ?? [];
        const latest = list.length > 0 ? list[list.length - 1] : undefined;
        if (!latest || cancelled) return;
        if (lastAlertedMessageIdRef.current === latest.id) return;
        lastAlertedMessageIdRef.current = latest.id;

        const body = previewForMessage(latest, t("chatPreviewFallback"));
        const perm = getBrowserNotificationPermission();
        setPermission(perm);

        let shown = false;
        if (perm === "granted") {
          shown = await showSystemNotification({
            id: `chat-${latest.id}`,
            title: latest.user_name?.trim() || t("chatDesktopTitle"),
            body,
            href: "/team-chat",
            tag: `spiora-team-chat-${latest.id}`,
            autoCloseMs: 0,
          });
        }

        // Prefer OS sound; fall back to in-app ping if toast could not show.
        if (!shown && isNotificationSoundEnabled()) {
          playNotificationSound({
            allowHidden: isAppInBackground() || document.visibilityState === "hidden",
          });
        }
      } catch {
        // ignore
      }
    }

    async function tick() {
      try {
        const res = await fetch("/api/team-chat/unread");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unread?: number };
        const unread = Math.max(0, data.unread ?? 0);
        const prev = prevUnreadRef.current;
        prevUnreadRef.current = unread;

        // Skip the first sample so we don't alert on page load for old unread.
        if (prev === null) return;
        if (unread > prev) {
          await alertForLatestMessage();
        }
      } catch {
        // ignore
      }
    }

    const schedule = () => {
      if (timer != null) window.clearInterval(timer);
      const hidden =
        typeof document !== "undefined" &&
        (document.visibilityState === "hidden" || isAppInBackground());
      timer = window.setInterval(() => {
        void tick();
      }, hidden ? 2000 : 3000);
    };

    void tick();
    schedule();

    const onVis = () => {
      schedule();
      void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("blur", onVis);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("blur", onVis);
    };
  }, [onTeamChat, t]);

  if (!showBanner || permission === "granted" || permission === "unsupported") {
    return null;
  }

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        {permission === "denied" ? t("desktopBannerBlocked") : t("desktopBanner")}
      </p>
      <div className={styles.actions}>
        {permission !== "denied" ? (
          <button
            type="button"
            className={styles.enable}
            onClick={() => {
              void (async () => {
                void unlockNotificationAudio();
                const next = await requestBrowserNotificationPermission();
                setPermission(next);
                if (next === "granted") setShowBanner(false);
              })();
            }}
          >
            {t("desktopBannerEnable")}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_PERMISSION_KEY, "1");
            } catch {
              // ignore
            }
            setShowBanner(false);
          }}
        >
          {t("desktopBannerDismiss")}
        </button>
      </div>
    </div>
  );
}
