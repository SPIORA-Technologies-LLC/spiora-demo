"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { withClientPortalEntrySplash } from "@/lib/client-portal/entry-splash";
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browser";
import styles from "./ClientInvitePage.module.css";

export function ClientPortalLogin() {
  const t = useTranslations("clientPortal.login");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google_access_denied") {
      setError(t("googleAccessDenied"));
    }
  }, [t]);

  async function continueWithGoogle() {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/auth/oauth/google", {
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
        setError(t("googleAccessDenied"));
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError(t("googleAccessDenied"));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseBrowserConfigured()) {
      setError(t("authUnavailable"));
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) {
        setError(t("authFailed"));
        return;
      }
      const res = await fetch("/api/client/session", { cache: "no-store" });
      if (!res.ok) {
        await supabase.auth.signOut();
        setError(t("notClient"));
        return;
      }
      window.location.href = withClientPortalEntrySplash("/client");
    } catch {
      setError(t("authFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page} lang={locale}>
      <div className={styles.card}>
        <div className={styles.top}>
          <Logo size="md" />
          <LanguageSwitcher />
        </div>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.muted}>{t("subtitle")}</p>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          type="button"
          className={styles.secondary}
          onClick={() => void continueWithGoogle()}
          disabled={busy || googleBusy}
        >
          {googleBusy ? t("working") : t("continueWithGoogle")}
        </button>
        <p className={styles.hint}>{t("orDivider")}</p>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <label className={styles.label}>
            {t("email")}
            <input
              className={styles.input}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy || googleBusy}
            />
          </label>
          <label className={styles.label}>
            {t("password")}
            <span className={styles.passwordField}>
              <input
                className={styles.input}
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={busy || googleBusy}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                aria-pressed={showPassword}
                disabled={busy || googleBusy}
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
            className={styles.primary}
            disabled={busy || googleBusy}
          >
            {busy ? t("working") : t("submit")}
          </button>
          <p className={styles.muted}>
            <a href="/client/forgot-password">{t("forgotPassword")}</a>
          </p>
        </form>
      </div>
    </div>
  );
}
