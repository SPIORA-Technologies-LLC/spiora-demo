"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import loginStyles from "@/app/login/login.module.css";
import clientStyles from "@/components/client-portal/ClientInvitePage.module.css";

type Audience = "employee" | "client";

export function ForgotPasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isClient = audience === "client";
  const styles = isClient ? clientStyles : loginStyles;

  const endpoint = isClient
    ? "/api/client/auth/password/forgot"
    : "/api/auth/password/forgot";
  const loginHref = isClient ? "/client/login" : "/login";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: { code?: string };
      };
      if (!res.ok) {
        setError(
          data.error?.code === "RATE_LIMITED"
            ? t("errors.rateLimited")
            : t("errors.generic"),
        );
        return;
      }
      setMessage(t("forgot.sent"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => void onSubmit(e)}
      style={isClient ? undefined : { textAlign: "left" }}
    >
      <h1 className={styles.title}>{t("forgot.title")}</h1>
      {message ? (
        <p className={isClient ? styles.info : styles.success}>{message}</p>
      ) : (
        <p className={isClient ? styles.muted : styles.subtitle}>
          {t("forgot.hint")}
        </p>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <label className={styles.label}>
        {t("fields.email")}
        <input
          className={styles.input}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={busy}
        />
      </label>
      <button
        type="submit"
        className={isClient ? styles.primary : styles.submit}
        disabled={busy}
      >
        {busy ? t("forgot.sending") : t("forgot.submit")}
      </button>
      <p className={isClient ? styles.backRow : styles.forgotHint}>
        <Link href={loginHref}>{t("backToLogin")}</Link>
      </p>
    </form>
  );
}
