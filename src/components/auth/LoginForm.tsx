"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  demoBypassSignInAction,
  signInAction,
  type SignInState,
} from "@/app/login/actions";
import { resetMobileNavIntro } from "@/lib/layout/mobile-nav-intro";
import styles from "@/app/login/login.module.css";

const initialState: SignInState = {};

const isDev = process.env.NODE_ENV === "development";

type LoginFormProps = {
  nextPath?: string;
  authError?: string | null;
  mfaReenroll?: boolean;
  demoBypassEnabled?: boolean;
};

export function LoginForm({
  nextPath,
  authError,
  mfaReenroll,
  demoBypassEnabled = false,
}: LoginFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [demoState, demoFormAction, demoPending] = useActionState(
    demoBypassSignInAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const queryMessage =
    authError === "google_access_denied"
      ? t("googleAccessDenied")
      : authError === "unsupported_callback"
        ? t("unsupportedCallback")
        : null;

  useEffect(() => {
    resetMobileNavIntro();
  }, []);

  useEffect(() => {
    const redirectTo = state.redirectTo || demoState.redirectTo;
    if (!redirectTo) return;
    resetMobileNavIntro();
    window.location.assign(redirectTo);
  }, [demoState.redirectTo, state.redirectTo]);

  async function continueWithGoogle() {
    if (pending || googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const res = await fetch("/api/auth/oauth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const data = (await res.json()) as {
        url?: string;
        error?: { code?: string };
      };
      if (!res.ok || !data.url) {
        setGoogleError(
          data.error?.code === "RATE_LIMITED"
            ? t("rateLimitExceeded")
            : t("googleAccessDenied"),
        );
        return;
      }
      window.location.assign(data.url);
    } catch {
      setGoogleError(t("googleAccessDenied"));
    } finally {
      setGoogleBusy(false);
    }
  }

  const busy = pending || demoPending || googleBusy;
  const bannerError = demoState.error || state.error || googleError || queryMessage;

  return (
    <div className={styles.authStack}>
      {mfaReenroll ? (
        <p className={styles.success} role="status">
          {t("mfaReenrollNotice")}
        </p>
      ) : null}
      {bannerError ? (
        <p className={styles.error} role="alert">
          {bannerError}
        </p>
      ) : null}

      <form className={styles.form} action={formAction}>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <label className={styles.label}>
          {t("email")}
          <input
            type="email"
            name="email"
            className={styles.input}
            defaultValue={isDev ? "olivia@spiora.demo" : undefined}
            placeholder="olivia@spiora.demo"
            autoComplete="email"
            required
            disabled={busy}
          />
        </label>
        <label className={styles.label}>
          {t("password")}
          <span className={styles.passwordField}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              className={styles.input}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={busy}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              aria-pressed={showPassword}
              disabled={busy}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                  />
                  <path
                    fill="currentColor"
                    d="M3.3 3.3 20.7 20.7l-1.4 1.4L1.9 4.7z"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                  />
                </svg>
              )}
            </button>
          </span>
        </label>
        <button
          type="submit"
          className={styles.submit}
          disabled={busy}
        >
          {busy ? t("signingIn") : t("signIn")}
        </button>
        <p className={styles.forgotHint}>
          <a href="/forgot-password">{t("forgotPasswordLink")}</a>
        </p>
      </form>

      {demoBypassEnabled ? (
        <>
          <p className={styles.orDivider}>{t("orDivider")}</p>
          <form action={demoFormAction}>
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <button
              type="submit"
              className={styles.secondaryAction}
              disabled={busy}
            >
              {demoPending ? t("signingIn") : t("demoBypassSignIn")}
            </button>
          </form>
        </>
      ) : null}

      <p className={styles.orDivider}>{t("orDivider")}</p>

      <button
        type="button"
        className={styles.googleButton}
        onClick={() => void continueWithGoogle()}
        disabled={busy}
      >
        {googleBusy ? t("signingIn") : t("continueWithGoogle")}
      </button>
    </div>
  );
}
