"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import loginStyles from "@/app/login/login.module.css";
import clientStyles from "@/components/client-portal/ClientInvitePage.module.css";

type Audience = "employee" | "client";

export function ChangePasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const isClient = audience === "client";
  const styles = isClient ? clientStyles : loginStyles;

  const endpoint = isClient
    ? "/api/client/auth/password/change"
    : "/api/auth/password/change";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(false);
    if (newPassword !== confirm) {
      setError(t("errors.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: { code?: string };
      };
      if (!res.ok) {
        if (data.error?.code === "CURRENT_PASSWORD_VERIFICATION_FAILED") {
          setError(t("errors.currentPasswordFailed"));
        } else if (data.error?.code === "RATE_LIMITED") {
          setError(t("errors.rateLimited"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
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
      <h1 className={styles.title}>{t("change.title")}</h1>
      <p className={isClient ? styles.muted : styles.subtitle}>
        {t("change.hint")}
      </p>
      {success ? (
        <p className={isClient ? styles.info : styles.success}>
          {t("change.success")}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <label className={styles.label}>
        {t("fields.currentPassword")}
        <input
          className={styles.input}
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
      <label className={styles.label}>
        {t("fields.newPassword")}
        <input
          className={styles.input}
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
        {busy ? t("change.saving") : t("change.submit")}
      </button>
    </form>
  );
}
