"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import { Logo } from "@/components/ui/Logo";
import { getNavItemsForRole } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";
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

export function Sidebar({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navItems = getNavItemsForRole(role);
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const t = useTranslations("shell");
  const [teamChatUnread, setTeamChatUnread] = useState(0);

  const [compactLogo, setCompactLogo] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const syncLogoSize = () => setCompactLogo(media.matches);
    syncLogoSize();
    media.addEventListener("change", syncLogoSize);
    return () => media.removeEventListener("change", syncLogoSize);
  }, []);

  useEffect(() => {
    if (pathname === "/team-chat" || pathname.startsWith("/team-chat/")) {
      setTeamChatUnread(0);
      return;
    }

    let cancelled = false;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/team-chat/unread");
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number };
        if (!cancelled) {
          setTeamChatUnread(Math.max(0, data.unread ?? 0));
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

  return (
    <aside className={styles.sidebar}>
      <Logo
        href="/dashboard"
        size={compactLogo ? "compact" : "sidebar"}
        priority
        className={styles.brand}
      />

      <nav className={styles.nav} aria-label={t("mainNavAria")}>
        <ul className={styles.navList}>
          {navItems.map((item) => {
            const active = !item.external && isActive(pathname, item.href);
            const className = [
              styles.navLink,
              item.external ? styles.navLinkExternal : "",
              active ? styles.active : "",
            ]
              .filter(Boolean)
              .join(" ");

            const label = resolveNavLabel(item, tNav, tShell);

            const content = (
              <>
                <i className={[item.icon, styles.icon].join(" ")} aria-hidden />
                <span className={styles.navLabel}>
                  {label}
                  {item.href === "/team-chat" && teamChatUnread > 0 ? (
                    <span className={styles.unreadBadge}> ({teamChatUnread})</span>
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
                key={item.href}
                className={item.external ? styles.navItemExternal : undefined}
              >
                {item.external ? (
                  <a
                    href={item.href}
                    className={className}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className={className}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
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
        <form action={signOutAction}>
          <button type="submit" className={styles.logoutBtn}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden />
            {tNav("logout")}
          </button>
        </form>
      </div>
    </aside>
  );
}
