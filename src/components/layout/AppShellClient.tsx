"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";
import styles from "./AppShell.module.css";
import type { UserRole } from "@/lib/auth/types";

const MOBILE_NAV_MEDIA = "(max-width: 900px)";
const MOBILE_NAV_INTRO_KEY = "spiora-mobile-nav-intro-seen";

export type AppShellClientProps = TopbarProps & {
  role: UserRole;
  children: ReactNode;
  contentClassName?: string;
  autoOpenMobileNav?: boolean;
};

export function AppShellClient({
  role,
  children,
  contentClassName,
  autoOpenMobileNav = false,
  ...topbarProps
}: AppShellClientProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [navDismissed, setNavDismissed] = useState(false);

  const dismissNav = useCallback(() => {
    setNavOpen(false);
    setNavDismissed(true);
    sessionStorage.setItem(MOBILE_NAV_INTRO_KEY, "1");
  }, []);

  useLayoutEffect(() => {
    if (!autoOpenMobileNav) return;

    if (sessionStorage.getItem(MOBILE_NAV_INTRO_KEY)) {
      setNavDismissed(true);
      return;
    }

    if (window.matchMedia(MOBILE_NAV_MEDIA).matches) {
      setNavOpen(true);
    }
  }, [autoOpenMobileNav]);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  const showMobileIntro = autoOpenMobileNav && !navDismissed;

  return (
    <div
      className={styles.shell}
      data-mobile-nav-intro={showMobileIntro ? "" : undefined}
      data-nav-dismissed={navDismissed ? "" : undefined}
    >
      <div
        className={[
          styles.sidebarWrap,
          navOpen ? styles.sidebarWrapOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!navOpen && navDismissed ? true : undefined}
      >
        <Sidebar role={role} onNavigate={dismissNav} />
      </div>

      <div className={styles.main}>
        <Topbar
          {...topbarProps}
          onToggleNav={() => setNavOpen((open) => !open)}
        />
        <main
          className={[styles.content, contentClassName].filter(Boolean).join(" ")}
          onClick={() => {
            if (navOpen) dismissNav();
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
