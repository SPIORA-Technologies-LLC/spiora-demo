"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import styles from "@/app/login/login.module.css";

export function ClientMfaChallengeForm({ nextPath }: { nextPath: string }) {
  const t = useTranslations("clientPortal.mfa");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/auth/mfa/challenge/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code, next: nextPath }),
      });
      const data = (await res.json()) as {
        redirectTo?: string;
        error?: { code?: string };
      };
      if (!res.ok) {
        if (data.error?.code === "RATE_LIMITED") {
          setError(t("errors.rateLimited"));
        } else {
          setError(t("errors.invalidCode"));
        }
        return;
      }
      window.location.assign(data.redirectTo || "/client?enter=1");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await fetch("/api/client/logout", { method: "POST" });
    window.location.href = "/client/login";
  }

  return (
    <form className={styles.form} onSubmit={(e) => void onSubmit(e)} style={{ textAlign: "left" }}>
      <h1 className={styles.title}>{t("challenge.title")}</h1>
      <p className={styles.subtitle}>{t("challenge.hint")}</p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <label className={styles.label}>
        {t("challenge.codeLabel")}
        <input
          className={styles.input}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={busy}
        />
      </label>
      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? t("challenge.verifying") : t("challenge.submit")}
      </button>
      <div className={styles.secondaryActions}>
        <Link href="/client/mfa/recovery" className={styles.secondaryAction}>
          {t("challenge.useRecovery")}
        </Link>
        <button
          type="button"
          className={`${styles.secondaryAction} ${styles.secondaryActionQuiet}`}
          onClick={() => void onSignOut()}
          disabled={busy}
        >
          {t("challenge.signOut")}
        </button>
      </div>
    </form>
  );
}
