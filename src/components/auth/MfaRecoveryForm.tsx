"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import styles from "@/app/login/login.module.css";

export function MfaRecoveryForm() {
  const t = useTranslations("authMfa");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        redirectTo?: string;
        error?: { code?: string };
      };
      if (!res.ok) {
        if (data.error?.code === "RATE_LIMITED") {
          setError(t("errors.rateLimited"));
        } else if (data.error?.code === "INVALID_CODE") {
          setError(t("errors.invalidRecovery"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }
      window.location.assign(data.redirectTo || "/login?mfa_reenroll=1");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void onSubmit(e)} style={{ textAlign: "left" }}>
      <h1 className={styles.title}>{t("recovery.title")}</h1>
      <p className={styles.subtitle}>{t("recovery.hint")}</p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <label className={styles.label}>
        {t("recovery.codeLabel")}
        <input
          className={styles.input}
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={busy}
          placeholder="XXXX-XXXX"
        />
      </label>
      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? t("recovery.working") : t("recovery.submit")}
      </button>
      <p className={styles.subtitle} style={{ marginTop: "1rem", marginBottom: 0 }}>
        <Link href="/mfa/challenge">{t("recovery.backToChallenge")}</Link>
      </p>
    </form>
  );
}
