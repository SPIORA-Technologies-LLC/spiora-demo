"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import loginStyles from "@/app/login/login.module.css";
import clientStyles from "@/components/client-portal/ClientInvitePage.module.css";

type Audience = "employee" | "client";

export function ResetPasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isClient = audience === "client";
  const styles = isClient ? clientStyles : loginStyles;

  const endpoint = isClient
    ? "/api/client/auth/password/reset"
    : "/api/auth/password/reset";
  const loginHref = isClient ? "/client/login" : "/login";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (password !== confirm) {
      setError(t("errors.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        requireLogin?: boolean;
        error?: { code?: string };
      };
      if (!res.ok) {
        setError(
          data.error?.code === "RECOVERY_GATE_INVALID"
            ? t("errors.recoveryExpired")
            : data.error?.code === "RATE_LIMITED"
              ? t("errors.rateLimited")
              : t("errors.generic"),
        );
        return;
      }
      router.replace(`${loginHref}?reset=1`);
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
      <h1 className={styles.title}>{t("reset.title")}</h1>
      <p className={isClient ? styles.muted : styles.subtitle}>
        {t("reset.hint")}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <label className={styles.label}>
        {t("fields.newPassword")}
        <input
          className={styles.input}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={busy}
        />
      </label>
      <label className={styles.label}>
        {t("fields.confirmPassword")}
        <input
          className={styles.input}
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={busy}
        />
      </label>
      <button
        type="submit"
        className={isClient ? styles.primary : styles.submit}
        disabled={busy}
      >
        {busy ? t("reset.saving") : t("reset.submit")}
      </button>
    </form>
  );
}
