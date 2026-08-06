"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Audience = "employee" | "client";

export function ChangePasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const endpoint =
    audience === "employee"
      ? "/api/auth/password/change"
      : "/api/client/auth/password/change";

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
      const data = (await res.json()) as { ok?: boolean; error?: { code?: string } };
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
    <form onSubmit={(e) => void onSubmit(e)}>
      <h1>{t("change.title")}</h1>
      <p>{t("change.hint")}</p>
      {success ? <p>{t("change.success")}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <label>
        {t("fields.currentPassword")}
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <label>
        {t("fields.newPassword")}
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        {t("fields.confirmPassword")}
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? t("change.saving") : t("change.submit")}
      </button>
    </form>
  );
}
