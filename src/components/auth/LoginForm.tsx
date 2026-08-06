"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { signInAction, type SignInState } from "@/app/login/actions";
import { resetMobileNavIntro } from "@/lib/layout/mobile-nav-intro";
import styles from "@/app/login/login.module.css";

const initialState: SignInState = {};

const isDev = process.env.NODE_ENV === "development";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    resetMobileNavIntro();
  }, []);

  useEffect(() => {
    if (!state.redirectTo) return;
    resetMobileNavIntro();
    window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  return (
    <form className={styles.form} action={formAction}>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
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
          disabled={pending}
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
            disabled={pending}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            disabled={pending}
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
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </button>
      <p className={styles.forgotHint}>
        <a href="/forgot-password">{t("forgotPasswordLink")}</a>
      </p>
    </form>
  );
}
