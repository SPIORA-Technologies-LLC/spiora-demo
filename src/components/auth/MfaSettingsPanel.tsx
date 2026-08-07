"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import styles from "@/app/login/login.module.css";

type Status = {
  verifiedTotpCount: number;
  verifiedFactorId: string | null;
  unusedRecoveryCodes: number;
  mfaReenrollRequired: boolean;
  challengeRequired: boolean;
};

export function MfaSettingsPanel() {
  const t = useTranslations("authMfa");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/status", { credentials: "same-origin" });
      if (res.status === 404) {
        setError(t("errors.disabled"));
        return;
      }
      if (!res.ok) {
        setError(t("errors.generic"));
        return;
      }
      const data = (await res.json()) as Status;
      setStatus(data);
    } catch {
      setError(t("errors.generic"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startEnroll() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setRecoveryCodes(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        factorId?: string;
        qrCode?: string;
        secret?: string;
        error?: { code?: string };
      };
      if (!res.ok) {
        setError(
          data.error?.code === "ALREADY_ENROLLED"
            ? t("errors.alreadyEnrolled")
            : t("errors.generic"),
        );
        return;
      }
      setFactorId(data.factorId ?? null);
      setQrCode(data.qrCode ?? null);
      setSecret(data.secret ?? null);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !factorId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ factorId, code }),
      });
      const data = (await res.json()) as {
        recoveryCodes?: string[];
        error?: { code?: string };
      };
      if (!res.ok) {
        setError(t("errors.invalidCode"));
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode("");
      await load();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    if (busy) return;
    if (!window.confirm(t("settings.disableConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError(t("errors.generic"));
        return;
      }
      setRecoveryCodes(null);
      await load();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes() {
    if (busy) return;
    if (!window.confirm(t("settings.regenerateConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/recovery-codes", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { recoveryCodes?: string[] };
      if (!res.ok) {
        setError(t("errors.generic"));
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      await load();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "left" }}>
      <h1 className={styles.title}>{t("settings.title")}</h1>
      <p className={styles.subtitle}>{t("settings.hint")}</p>
      {error ? <p className={styles.error}>{error}</p> : null}

      {status?.mfaReenrollRequired ? (
        <p className={styles.error}>{t("settings.reenrollRequired")}</p>
      ) : null}

      {status && status.verifiedTotpCount > 0 ? (
        <div style={{ marginBottom: "1.25rem" }}>
          <p className={styles.subtitle}>
            {t("settings.enabled", { count: status.unusedRecoveryCodes })}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={styles.submit}
              onClick={() => void regenerateCodes()}
              disabled={busy}
            >
              {t("settings.regenerate")}
            </button>
            <button
              type="button"
              className={styles.submit}
              onClick={() => void disableMfa()}
              disabled={busy}
              style={{ background: "transparent", border: "1px solid var(--border-soft)" }}
            >
              {t("settings.disable")}
            </button>
          </div>
        </div>
      ) : null}

      {status && status.verifiedTotpCount === 0 && !factorId ? (
        <button
          type="button"
          className={styles.submit}
          onClick={() => void startEnroll()}
          disabled={busy}
        >
          {busy ? t("settings.starting") : t("settings.enable")}
        </button>
      ) : null}

      {factorId && qrCode ? (
        <form className={styles.form} onSubmit={(e) => void verifyEnroll(e)}>
          <p className={styles.subtitle}>{t("settings.scanHint")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              qrCode.startsWith("data:")
                ? qrCode
                : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`
            }
            alt=""
            width={180}
            height={180}
            style={{ display: "block", margin: "0 auto 1rem", background: "#fff" }}
          />
          {secret ? (
            <p className={styles.subtitle}>
              {t("settings.secretLabel")}: <code>{secret}</code>
            </p>
          ) : null}
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
            {busy ? t("challenge.verifying") : t("settings.confirm")}
          </button>
        </form>
      ) : null}

      {recoveryCodes ? (
        <div style={{ marginTop: "1.25rem" }}>
          <p className={styles.subtitle}>{t("settings.codesHint")}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {recoveryCodes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className={styles.subtitle} style={{ marginTop: "1.5rem" }}>
        <Link href="/settings/password">{t("settings.passwordLink")}</Link>
        {" · "}
        <Link href="/settings">{t("settings.back")}</Link>
      </p>
    </div>
  );
}
