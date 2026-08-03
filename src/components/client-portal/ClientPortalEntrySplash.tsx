"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";
import { CLIENT_PORTAL_ENTRY_SPLASH_PARAM } from "@/lib/client-portal/entry-splash";
import styles from "./ClientPortalEntrySplash.module.css";

const SPLASH_MS = 2200;
const SPLASH_REDUCED_MS = 450;

type Props = {
  onDone: () => void;
};

export function ClientPortalEntrySplash({ onDone }: Props) {
  const t = useTranslations("clientPortal.splash");

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(onDone, reduced ? SPLASH_REDUCED_MS : SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(CLIENT_PORTAL_ENTRY_SPLASH_PARAM)) return;
      url.searchParams.delete(CLIENT_PORTAL_ENTRY_SPLASH_PARAM);
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className={styles.splash} role="status" aria-live="polite" aria-label={t("label")}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.mark}>
        <Logo size="lg" priority />
      </div>
    </div>
  );
}
