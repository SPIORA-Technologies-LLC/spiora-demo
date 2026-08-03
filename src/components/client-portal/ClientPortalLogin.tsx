"use client";

import { useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
            />
          </label>
          <label className={styles.label}>
            {t("password")}
            <input
              className={styles.input}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? t("working") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
