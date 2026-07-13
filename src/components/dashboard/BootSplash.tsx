"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/Logo";
import styles from "./BootSplash.module.css";

const STORAGE_KEY = "spiora-boot-splash-seen";

export function BootSplash() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (seen) return;

    setVisible(true);
    const glowTimer = window.setTimeout(() => {
      setFadeOut(true);
    }, 1400);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, 1900);

    return () => {
      window.clearTimeout(glowTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={[styles.overlay, fadeOut ? styles.overlayOut : ""].filter(Boolean).join(" ")}
      aria-hidden
    >
      <div className={styles.inner}>
        <div className={styles.logoWrap}>
          <LogoMark priority size="lg" className={styles.logo} />
        </div>
        <div className={styles.powerGlow} aria-hidden />
      </div>
    </div>
  );
}
