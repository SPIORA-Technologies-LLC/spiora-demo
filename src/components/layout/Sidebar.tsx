"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import { Logo } from "@/components/ui/Logo";
import { PwaInstallSidebarButton } from "@/components/pwa/PwaInstallSidebarButton";
import { useNotificationsOptional } from "@/components/notifications/notification-context";
import { getNavItemsForRole } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";
import {
  getProductPresentationUrl,
  type BrandingLocale,
} from "@/config/branding";
import { setTeamChatUnreadForBadge } from "@/lib/notifications/app-badge";
import { getNotificationSection } from "@/lib/notifications/navigation";
import type { NotificationType } from "@/lib/notifications/types";
import styles from "./Sidebar.module.css";

export type NavItem = {
  href: string;
  label?: string;
  labelKey?: string;
  labelNs?: "nav" | "shell";
  icon: string;
  /** Внешняя ссылка (открывается в новой вкладке) */
  external?: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveNavLabel(
  item: NavItem,
  tNav: ReturnType<typeof useTranslations<"nav">>,
  tShell: ReturnType<typeof useTranslations<"shell">>,
): string {
  if (item.labelKey && item.labelNs === "shell") {
    return tShell(item.labelKey as "demoCompanySite");
  }
  if (item.labelKey) {
    return tNav(item.labelKey as "dashboard");
  }
  return item.label ?? item.href;
}

function countUnreadForSection(
  notifications: { type: string; message: string; is_read: boolean }[],
  section: "tasks" | "calendar",
): number {
  return notifications.reduce((count, item) => {
    if (item.is_read) return count;
    return getNotificationSection(item.type as NotificationType, item.message) ===
      section
      ? count + 1
      : count;
  }, 0);
}

export function Sidebar({
  role,
  onNavItemClick,
}: {
  role: UserRole;
  onNavItemClick?: (href: string) => void;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const navItems = getNavItemsForRole(role);
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const t = useTranslations("shell");
  const notificationsCtx = useNotificationsOptional();
  const [teamChatUnread, setTeamChatUnread] = useState(0);

  const onTasks = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const onCalendar =
    pathname === "/calendar" || pathname.startsWith("/calendar/");

  const tasksUnread = useMemo(() => {
    if (onTasks) return 0;
    return countUnreadForSection(
      notificationsCtx?.notifications ?? [],
      "tasks",
    );
  }, [notificationsCtx?.notifications, onTasks]);

  const calendarUnread = useMemo(() => {
    if (onCalendar) return 0;
    return countUnreadForSection(
      notificationsCtx?.notifications ?? [],
      "calendar",
    );
  }, [notificationsCtx?.notifications, onCalendar]);

  function resolveNavHref(item: NavItem): string {
    if (item.labelKey === "demoCompanySite") {
      const brandingLocale: BrandingLocale = locale === "ru" ? "ru" : "en";
      return getProductPresentationUrl(brandingLocale);
    }
    return item.href;
  }

  useEffect(() => {
    if (pathname === "/team-chat" || pathname.startsWith("/team-chat/")) {
      setTeamChatUnread(0);
      void setTeamChatUnreadForBadge(0);
      return;
    }

    let cancelled = false;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/team-chat/unread");
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number };
        if (!cancelled) {
          const next = Math.max(0, data.unread ?? 0);
          setTeamChatUnread(next);
          void setTeamChatUnreadForBadge(next);
        }
      } catch {
        // ignore
      }
    }

    void fetchUnread();
    const timer = setInterval(() => {
      void fetchUnread();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname]);

  const handleInternalNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (
      !onNavItemClick ||
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 900px)").matches
    ) {
      return;
    }

    event.preventDefault();
    onNavItemClick(href);
  };

  function navUnreadBadge(href: string): number {
    if (href === "/team-chat") return teamChatUnread;
    if (href === "/tasks") return tasksUnread;
    if (href === "/calendar") return calendarUnread;
    return 0;
  }

  return (
    <aside className={styles.sidebar}>
      <Logo
        href="/dashboard"
        size="sidebar"
        priority
        className={[styles.brand, styles.brandDesktop].join(" ")}
        onNavigate={
          onNavItemClick
            ? (event) => handleInternalNavClick(event, "/dashboard")
            : undefined
        }
      />
      <Logo
        href="/dashboard"
        size="compact"
        priority
        className={[styles.brand, styles.brandMobile, styles.brandMobileLogo].join(
          " ",
        )}
        onNavigate={
          onNavItemClick
            ? (event) => handleInternalNavClick(event, "/dashboard")
            : undefined
        }
      />

      <nav className={styles.nav} aria-label={t("mainNavAria")}>
        <ul className={styles.navList}>
          {navItems.map((item) => {
            const href = resolveNavHref(item);
            const active = !item.external && isActive(pathname, href);
            const className = [
              styles.navLink,
              item.external ? styles.navLinkExternal : "",
              active ? styles.active : "",
            ]
              .filter(Boolean)
              .join(" ");

            const label = resolveNavLabel(item, tNav, tShell);
            const unreadCount = navUnreadBadge(href);

            const content = (
              <>
                <i className={[item.icon, styles.icon].join(" ")} aria-hidden />
                <span className={styles.navLabel}>
                  {label}
                  {unreadCount > 0 ? (
                    <span className={styles.unreadBadge}> ({unreadCount})</span>
                  ) : null}
                </span>
                {item.external ? (
                  <i
                    className={`fa-solid fa-arrow-up-right-from-square ${styles.externalIcon}`}
                    aria-hidden
                  />
                ) : null}
              </>
            );

            return (
              <li
                key={item.labelKey ?? href}
                className={item.external ? styles.navItemExternal : undefined}
              >
                {item.external ? (
                  <a
                    href={href}
                    className={className}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    href={href}
                    className={className}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => handleInternalNavClick(event, href)}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.mobileFooter}>
        <PwaInstallSidebarButton />
        <form action={signOutAction}>
          <button type="submit" className={styles.logoutBtn}>
            <i
              className={`fa-solid fa-right-from-bracket ${styles.logoutIcon}`}
              aria-hidden
            />
            {tNav("logout")}
          </button>
        </form>
      </div>
    </aside>
  );
}
