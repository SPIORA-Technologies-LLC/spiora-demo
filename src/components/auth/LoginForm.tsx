"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { signInAction, type SignInState } from "@/app/login/actions";
import { clearMobileNavIntroSeen } from "@/lib/layout/mobile-nav-intro";
import styles from "@/app/login/login.module.css";

const initialState: SignInState = {};

const isDev = process.env.NODE_ENV === "development";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  useEffect(() => {
    clearMobileNavIntroSeen();
  }, []);

  useEffect(() => {
    if (!state.redirectTo) return;
    clearMobileNavIntroSeen();
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
        <input
          type="password"
          name="password"
          className={styles.input}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </button>
      <p className={styles.forgotHint}>{t("forgotPasswordHint")}</p>
    </form>
  );
}
