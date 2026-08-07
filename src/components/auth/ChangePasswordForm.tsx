"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import loginStyles from "@/app/login/login.module.css";
import clientStyles from "@/components/client-portal/ClientInvitePage.module.css";

type Audience = "employee" | "client";

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
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
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
      />
    </svg>
  );
}

export function ChangePasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const locale = useLocale();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const isClient = audience === "client";
  const styles = isClient ? clientStyles : loginStyles;
  const continueHref = isClient ? "/client" : "/settings";

  const endpoint = isClient
    ? "/api/client/auth/password/change"
    : "/api/auth/password/change";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || success) return;
    setError(null);
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
        body: JSON.stringify({ currentPassword, newPassword, locale }),
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
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div
        className={styles.form}
        style={isClient ? undefined : { textAlign: "left" }}
        role="status"
      >
        <h1 className={styles.title}>{t("change.successTitle")}</h1>
        <p className={isClient ? styles.muted : styles.subtitle}>
          {t("change.successBody")}
        </p>
        <button
          type="button"
          className={isClient ? styles.primary : styles.submit}
          onClick={() => router.replace(continueHref)}
        >
          {isClient
            ? t("change.successContinueClient")
            : t("change.successContinueEmployee")}
        </button>
      </div>
    );
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
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <label className={styles.label}>
        {t("fields.currentPassword")}
        <span className={styles.passwordField}>
          <input
            className={styles.input}
            type={showCurrent ? "text" : "password"}
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? t("hidePassword") : t("showPassword")}
            aria-pressed={showCurrent}
            disabled={busy}
          >
            <PasswordVisibilityIcon visible={showCurrent} />
          </button>
        </span>
      </label>
      <label className={styles.label}>
        {t("fields.newPassword")}
        <span className={styles.passwordField}>
          <input
            className={styles.input}
            type={showNew ? "text" : "password"}
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? t("hidePassword") : t("showPassword")}
            aria-pressed={showNew}
            disabled={busy}
          >
            <PasswordVisibilityIcon visible={showNew} />
          </button>
        </span>
      </label>
      <label className={styles.label}>
        {t("fields.confirmPassword")}
        <span className={styles.passwordField}>
          <input
            className={styles.input}
            type={showConfirm ? "text" : "password"}
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
            aria-pressed={showConfirm}
            disabled={busy}
          >
            <PasswordVisibilityIcon visible={showConfirm} />
          </button>
        </span>
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
