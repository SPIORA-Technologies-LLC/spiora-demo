"use client";

import { useEffect, useState, type ReactNode } from "react";
import { branding } from "@/config/branding";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";
import styles from "./AppShell.module.css";
import type { UserRole } from "@/lib/auth/types";

const MOBILE_NAV_MEDIA = "(max-width: 900px)";

export type AppShellClientProps = TopbarProps & {
  role: UserRole;
  children: ReactNode;
  contentClassName?: string;
};

export function AppShellClient({
  role,
  children,
  contentClassName,
  ...topbarProps
}: AppShellClientProps) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!branding.demoMode) return;
    const media = window.matchMedia(MOBILE_NAV_MEDIA);
    if (media.matches) {
      setNavOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  return (
    <div className={styles.shell}>
      <div
        className={[
          styles.sidebarWrap,
          navOpen ? styles.sidebarWrapOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!navOpen ? true : undefined}
      >
        <Sidebar role={role} onNavigate={() => setNavOpen(false)} />
      </div>

      <div className={styles.main}>
        <Topbar
          {...topbarProps}
          onToggleNav={() => setNavOpen((open) => !open)}
        />
        <main
          className={[styles.content, contentClassName].filter(Boolean).join(" ")}
          onClick={() => {
            if (navOpen) setNavOpen(false);
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

