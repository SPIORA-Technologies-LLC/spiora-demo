"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Audience = "employee" | "client";

export function ForgotPasswordForm({ audience }: { audience: Audience }) {
  const t = useTranslations("authPassword");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const endpoint =
    audience === "employee"
      ? "/api/auth/password/forgot"
      : "/api/client/auth/password/forgot";
  const loginHref = audience === "employee" ? "/login" : "/client/login";

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
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
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
      setMessage(data.message ?? t("forgot.sent"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <h1>{t("forgot.title")}</h1>
      <p>{t("forgot.hint")}</p>
      {message ? <p>{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <label>
        {t("fields.email")}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? t("forgot.sending") : t("forgot.submit")}
      </button>
      <p>
        <Link href={loginHref}>{t("backToLogin")}</Link>
      </p>
    </form>
  );
}
