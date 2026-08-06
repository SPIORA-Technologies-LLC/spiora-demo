"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Audience = "employee" | "client";

export function ResetPasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const endpoint =
    audience === "employee"
      ? "/api/auth/password/reset"
      : "/api/client/auth/password/reset";
  const loginHref = audience === "employee" ? "/login" : "/client/login";

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
    <form onSubmit={(e) => void onSubmit(e)}>
      <h1>{t("reset.title")}</h1>
      <p>{t("reset.hint")}</p>
      {error ? <p role="alert">{error}</p> : null}
      <label>
        {t("fields.newPassword")}
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {busy ? t("reset.saving") : t("reset.submit")}
      </button>
    </form>
  );
}
