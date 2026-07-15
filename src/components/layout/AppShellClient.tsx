"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  consumeMobileNavPageEnter,
  dismissMobileNavIntro,
  isMobileNavIntroDismissed,
  markMobileNavPageEnter,
} from "@/lib/layout/mobile-nav-intro";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";
import styles from "./AppShell.module.css";
import type { UserRole } from "@/lib/auth/types";

const MOBILE_NAV_MEDIA = "(max-width: 900px)";
const MOBILE_NAV_CLOSE_MS = 320;

export type AppShellClientProps = TopbarProps & {
  role: UserRole;
  children: ReactNode;
  contentClassName?: string;
  autoOpenMobileNav?: boolean;
};

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_NAV_MEDIA).matches
  );
}

export function AppShellClient({
  role,
  children,
  contentClassName,
  autoOpenMobileNav = false,
  ...topbarProps
}: AppShellClientProps) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [navDismissed, setNavDismissed] = useState(false);
  const [navEnter, setNavEnter] = useState(false);

  const dismissNav = useCallback(() => {
    setNavOpen(false);
    setNavDismissed(true);
    dismissMobileNavIntro();
  }, []);

  const openMobileIntro = useCallback(() => {
    if (!autoOpenMobileNav) return;
    if (isMobileNavIntroDismissed()) {
      setNavDismissed(true);
      return;
    }
    if (!isMobileViewport()) return;
    setNavDismissed(false);
    setNavOpen(true);
  }, [autoOpenMobileNav]);

  useLayoutEffect(() => {
    openMobileIntro();
  }, [openMobileIntro]);

  useLayoutEffect(() => {
    if (consumeMobileNavPageEnter()) {
      setNavEnter(true);
    }
  }, []);

  useEffect(() => {
    if (!navEnter) return;
    const timer = window.setTimeout(() => setNavEnter(false), 420);
    return () => window.clearTimeout(timer);
  }, [navEnter]);

  useEffect(() => {
    if (!autoOpenMobileNav) return;
    const media = window.matchMedia(MOBILE_NAV_MEDIA);
    const onViewportChange = () => {
      if (media.matches) {
        openMobileIntro();
      }
    };
    media.addEventListener("change", onViewportChange);
    return () => media.removeEventListener("change", onViewportChange);
  }, [autoOpenMobileNav, openMobileIntro]);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  const handleNavItemClick = useCallback(
    (href: string) => {
      if (!isMobileViewport()) {
        router.push(href);
        return;
      }

      setNavOpen(false);

      window.setTimeout(() => {
        markMobileNavPageEnter();
        dismissNav();
        router.push(href);
      }, MOBILE_NAV_CLOSE_MS);
    },
    [dismissNav, router],
  );

  const showMobileIntro = autoOpenMobileNav && !navDismissed;

  return (
    <div
      className={styles.shell}
      data-mobile-nav-intro={showMobileIntro ? "" : undefined}
      data-nav-dismissed={navDismissed ? "" : undefined}
      data-nav-enter={navEnter ? "" : undefined}
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
        <Sidebar role={role} onNavItemClick={handleNavItemClick} />
      </div>

      <div className={styles.main}>
        <Topbar
          {...topbarProps}
          navOpen={navOpen}
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
