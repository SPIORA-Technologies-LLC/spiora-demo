"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import {
  formatNotificationTime,
  translateNotificationType,
  type NotificationTypeKey,
} from "@/i18n/notification-labels";
import {
  NOTIFICATION_TYPE_ICONS,
  isSuccessNotification,
} from "./constants";
import {
  getNotificationActionLabel,
  getNotificationDisplayMessage,
  getNotificationHref,
} from "@/lib/notifications/navigation";
import {
  isNotificationSoundEnabled,
  playNotificationSound,
  setNotificationSoundEnabled,
  unlockNotificationAudio,
} from "@/lib/notifications/play-sound";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showSystemNotification,
} from "@/lib/notifications/system-notify";
import { useNotificationsOptional } from "./notification-context";
import styles from "./NotificationBell.module.css";

export function NotificationBell() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("notifications");
  const tCalendar = useTranslations("calendar.notifications");
  const ctx = useNotificationsOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setSoundEnabled(isNotificationSoundEnabled());
    setDesktopPermission(getBrowserNotificationPermission());
  }, []);

  useEffect(() => {
    if (!open) return;
    setDesktopPermission(getBrowserNotificationPermission());
  }, [open]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", onDocClick);
    }

    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const unread = ctx?.unread ?? 0;
  const notifications = ctx?.notifications ?? [];
  const unreadNotifications = notifications.filter((item) => !item.is_read);
  const hasRead = notifications.length > unreadNotifications.length;
  const loading = ctx?.loading ?? false;

  async function handleOpenItem(
    id: string,
    isRead: boolean,
    type: (typeof notifications)[number]["type"],
    message: string,
  ) {
    if (!ctx) return;
    if (!isRead) {
      await ctx.markRead(id);
    }
    const href = getNotificationHref(type, message);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => {
          if (!ctx) return;
          void unlockNotificationAudio();
          setOpen((value) => !value);
        }}
        aria-label={t("ariaLabel")}
        aria-expanded={open}
        disabled={!mounted || !ctx}
      >
        <i className="fa-solid fa-bell" aria-hidden />
        {unread > 0 ? (
          <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>
        ) : null}
      </button>

      {open && ctx ? (
        <div
          className={styles.panel}
          role="dialog"
          aria-label={t("centerAria")}
        >
          <header className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{t("panelTitle")}</h3>
            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.soundToggle}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  setNotificationSoundEnabled(next);
                  if (next) void unlockNotificationAudio();
                }}
                title={soundEnabled ? t("soundOnTitle") : t("soundOffTitle")}
              >
                {soundEnabled ? t("soundOn") : t("soundOff")}
              </button>
              {unread > 0 ? (
                <button
                  type="button"
                  className={styles.markAll}
                  onClick={() => void ctx.markAllRead()}
                >
                  {t("markAllRead")}
                </button>
              ) : null}
              {hasRead ? (
                <button
                  type="button"
                  className={styles.clearRead}
                  onClick={() => void ctx.clearRead()}
                >
                  {t("clearRead")}
                </button>
              ) : null}
            </div>
          </header>

          {mounted ? (
            <div className={styles.desktopCallout}>
              <p className={styles.desktopCalloutText}>
                {desktopPermission === "granted"
                  ? t("desktopStatusOn")
                  : desktopPermission === "denied"
                    ? t("desktopBannerBlocked")
                    : desktopPermission === "unsupported"
                      ? t("desktopUnsupported")
                      : t("desktopBanner")}
              </p>
              <p className={styles.desktopCalloutHint}>{t("desktopWindowsHint")}</p>
              <div className={styles.desktopCalloutActions}>
                {desktopPermission !== "granted" &&
                desktopPermission !== "unsupported" &&
                desktopPermission !== "denied" ? (
                  <button
                    type="button"
                    className={styles.desktopCalloutBtn}
                    onClick={() => {
                      void (async () => {
                        void unlockNotificationAudio();
                        const next =
                          await requestBrowserNotificationPermission();
                        setDesktopPermission(next);
                      })();
                    }}
                  >
                    {t("desktopBannerEnable")}
                  </button>
                ) : null}
                {desktopPermission === "granted" ? (
                  <button
                    type="button"
                    className={styles.desktopCalloutBtn}
                    disabled={testBusy}
                    onClick={() => {
                      void (async () => {
                        setTestBusy(true);
                        setTestResult(null);
                        try {
                          void unlockNotificationAudio();
                          playNotificationSound({ allowHidden: true });
                          const shown = await showSystemNotification({
                            id: `test-${Date.now()}`,
                            title: "Spiora",
                            body: t("desktopTestBody"),
                            href: "/",
                            tag: `spiora-test-${Date.now()}`,
                            autoCloseMs: 12_000,
                            requireInteraction: true,
                            force: true,
                          });
                          setTestResult(
                            shown
                              ? t("desktopTestSent")
                              : t("desktopTestFailed"),
                          );
                        } finally {
                          setTestBusy(false);
                        }
                      })();
                    }}
                  >
                    {t("desktopTest")}
                  </button>
                ) : null}
              </div>
              {testResult ? (
                <p className={styles.desktopCalloutResult}>{testResult}</p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.list}>
            {loading && unreadNotifications.length === 0 ? (
              <p className={styles.empty}>{t("loading")}</p>
            ) : unreadNotifications.length === 0 ? (
              <p className={styles.empty}>{t("empty")}</p>
            ) : (
              unreadNotifications.map((item) => {
                const isSuccess = isSuccessNotification(item.type);
                const actionLabel = getNotificationActionLabel(
                  item.type,
                  item.message,
                  locale,
                  tCalendar("joinAction"),
                );
                return (
                <div
                  key={item.id}
                  className={[
                    styles.item,
                    item.is_read ? styles.itemRead : styles.itemUnread,
                    isSuccess ? styles.itemSuccess : "",
                    isSuccess && !item.is_read ? styles.itemSuccessUnread : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className={styles.itemTop}>
                    <button
                      type="button"
                      className={styles.itemTypeBtn}
                      onClick={() =>
                        void handleOpenItem(
                          item.id,
                          item.is_read,
                          item.type,
                          item.message,
                        )
                      }
                    >
                      <span
                        className={[
                          styles.itemType,
                          isSuccess ? styles.itemTypeSuccess : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {NOTIFICATION_TYPE_ICONS[item.type]}{" "}
                        {translateNotificationType(
                          locale,
                          item.type as NotificationTypeKey,
                        )}
                      </span>
                    </button>
                    <span className={styles.itemTime}>
                      {formatNotificationTime(item.created_at, locale)}
                    </span>
                    <button
                      type="button"
                      className={styles.closeBtn}
                      aria-label={t("closeItem")}
                      onClick={() => void ctx.removeNotification(item.id)}
                    >
                      ×
                    </button>
                  </div>
                  <p className={styles.itemTitle}>{item.title}</p>
                  {item.author_name ? (
                    <p className={styles.itemAuthor}>{item.author_name}</p>
                  ) : null}
                  <p
                    className={[
                      styles.itemMessage,
                      isSuccess ? styles.itemMessageSuccess : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {getNotificationDisplayMessage(item.type, item.message)}
                  </p>
                  {actionLabel ? (
                    <button
                      type="button"
                      className={styles.joinButton}
                      onClick={() =>
                        void handleOpenItem(
                          item.id,
                          item.is_read,
                          item.type,
                          item.message,
                        )
                      }
                    >
                      {actionLabel}
                    </button>
                  ) : null}
                </div>
              );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
