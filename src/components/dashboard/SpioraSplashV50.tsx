"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { APP_ENTRY_SPLASH_PARAM } from "@/lib/layout/app-entry-splash";
import styles from "./SpioraSplashV50.module.css";

const STORAGE_KEY = "spiora-boot-splash-v50-seen";

/** Full brand animation ~5.4s; then brief fade before revealing the app. */
const ANIMATION_MS = 5600;
const FADE_MS = 500;
const REDUCED_MOTION_MS = 400;

type Props = {
  /** When true, show every mount (no sessionStorage gate). Default: once per tab session. */
  force?: boolean;
  onDone?: () => void;
};

type Phase = "gate" | "play" | "done";

function consumeEntrySplashParam(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(APP_ENTRY_SPLASH_PARAM) !== "1") return false;
    url.searchParams.delete(APP_ENTRY_SPLASH_PARAM);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    sessionStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function shouldPlaySplash(force: boolean): boolean {
  if (force) return true;
  if (consumeEntrySplashParam()) return true;
  try {
    return !sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return true;
  }
}

/**
 * Boot splash for the employee app and client portal.
 *
 * `force` (client portal) SSRs the logo immediately so the OS/PWA app-icon
 * splash is replaced by the wordmark, not a second power icon. Without `force`,
 * a solid gate covers the dashboard until play-or-skip is decided.
 */
export function SpioraSplashV50({ force = false, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>(force ? "play" : "gate");
  const [exiting, setExiting] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    if (!shouldPlaySplash(force)) {
      setPhase("done");
      return;
    }

    setPhase("play");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduced ? REDUCED_MOTION_MS : ANIMATION_MS;

    const fadeTimer = window.setTimeout(() => setExiting(true), holdMs);
    const hideTimer = window.setTimeout(() => {
      setPhase("done");
      // Prop `force` (client portal) skips the tab gate; `enter=1` still marks seen.
      if (!force) {
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // ignore
        }
      }
      onDoneRef.current?.();
    }, holdMs + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [force]);

  if (phase === "done") return null;

  return (
    <div
      className={[
        styles.splash,
        phase === "gate" ? styles.splashGate : "",
        exiting ? styles.splashOut : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label="SPIORA"
    >
      {phase === "play" ? (
        <>
          <div className={styles.brandStage} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.brandFull}
              src="/splash-v50/spiora-logo-vector.svg"
              alt=""
              fetchPriority="high"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.brandPower}
              src="/splash-v50/spiora-power-only.svg"
              alt=""
              // Hidden until CSS animation so an unstyled first paint is the logo, not the icon.
              style={{ opacity: 0 }}
            />
          </div>

          <div className={styles.waveCrop} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash-v50/spiora-brandbook.png" alt="" />
            <span className={styles.waveGlint} />
          </div>
        </>
      ) : null}

      <span className={styles.srOnly}>SPIORA</span>
    </div>
  );
}
