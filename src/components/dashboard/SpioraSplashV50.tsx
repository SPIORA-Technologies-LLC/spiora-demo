"use client";

import { useEffect, useState } from "react";
import styles from "./SpioraSplashV50.module.css";

const STORAGE_KEY = "spiora-boot-splash-v50-seen";

/** Full brand animation ~5.4s; then brief fade before revealing the app. */
const ANIMATION_MS = 5600;
const FADE_MS = 500;
const REDUCED_MOTION_MS = 400;

type Props = {
  /** When true, show every mount (no sessionStorage gate). Default: once per tab session. */
  force?: boolean;
};

export function SpioraSplashV50({ force = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!force && sessionStorage.getItem(STORAGE_KEY)) return;

    setVisible(true);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduced ? REDUCED_MOTION_MS : ANIMATION_MS;

    const fadeTimer = window.setTimeout(() => setExiting(true), holdMs);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      if (!force) sessionStorage.setItem(STORAGE_KEY, "1");
    }, holdMs + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [force]);

  if (!visible) return null;

  return (
    <div
      className={[styles.splash, exiting ? styles.splashOut : ""].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-label="SPIORA"
    >
      <div className={styles.brandStage} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.brandFull}
          src="/splash-v50/spiora-logo-vector.svg"
          alt=""
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.brandPower}
          src="/splash-v50/spiora-power-only.svg"
          alt=""
        />
      </div>

      <div className={styles.waveCrop} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/splash-v50/spiora-brandbook.png" alt="" />
        <span className={styles.waveGlint} />
      </div>

      <span className={styles.srOnly}>SPIORA</span>
    </div>
  );
}
