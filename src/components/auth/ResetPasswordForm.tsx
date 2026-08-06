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

export function ResetPasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const locale = useLocale();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const isClient = audience === "client";
  const styles = isClient ? clientStyles : loginStyles;

  const endpoint = isClient
    ? "/api/client/auth/password/reset"
    : "/api/auth/password/reset";
  const loginHref = isClient ? "/client/login" : "/login";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || saved) return;
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
        body: JSON.stringify({ password, locale }),
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
      setSaved(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
          <span className={styles.passwordField}>
            <input
              className={styles.input}
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={busy || saved}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              aria-pressed={showPassword}
              disabled={busy || saved}
            >
              <PasswordVisibilityIcon visible={showPassword} />
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
              disabled={busy || saved}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
              aria-pressed={showConfirm}
              disabled={busy || saved}
            >
              <PasswordVisibilityIcon visible={showConfirm} />
            </button>
          </span>
        </label>
        <button
          type="submit"
          className={isClient ? styles.primary : styles.submit}
          disabled={busy || saved}
        >
          {busy ? t("reset.saving") : t("reset.submit")}
        </button>
      </form>

      {saved ? (
        <div
          className={loginStyles.successOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-reset-success-title"
        >
          <div className={loginStyles.successDialog}>
            <span className={loginStyles.successIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path
                  fill="currentColor"
                  d="M9.2 16.6 4.9 12.3l1.4-1.4 2.9 2.9 8.5-8.5 1.4 1.4z"
                />
              </svg>
            </span>
            <h2
              id="password-reset-success-title"
              className={loginStyles.successTitle}
            >
              {t("reset.successTitle")}
            </h2>
            <p className={loginStyles.successBody}>{t("reset.successBody")}</p>
            <button
              type="button"
              className={isClient ? styles.primary : loginStyles.submit}
              style={isClient ? { width: "100%" } : undefined}
              onClick={() => router.replace(loginHref)}
            >
              {t("reset.successContinue")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
