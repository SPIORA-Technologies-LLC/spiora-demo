"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatSignedAt } from "@/lib/client-portal/format-signed-at";
import type { ConsultingAgreementSignView } from "@/lib/client-portal/sign-types";
import styles from "./ConsultingAgreementSignPanel.module.css";

type Props = {
  sign: ConsultingAgreementSignView | null;
  disabled?: boolean;
  onSigned?: (sign: ConsultingAgreementSignView) => void;
};

function statusKey(status: ConsultingAgreementSignView["status"] | "none") {
  return status;
}

export function ConsultingAgreementSignPanel({
  sign,
  disabled = false,
  onSigned,
}: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("clientPortal.consultingAgreement.sign");
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [localSign, setLocalSign] = useState<ConsultingAgreementSignView | null>(
    sign,
  );
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSign(sign);
  }, [sign]);

  useEffect(() => {
    setCooldown(localSign?.otpCooldownSeconds ?? 0);
  }, [localSign?.otpCooldownSeconds]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const canStartClientSign = !localSign || Boolean(localSign.canClientSign);

  const canRequestOtp =
    canStartClientSign &&
    consent &&
    !disabled &&
    !busy &&
    cooldown <= 0;

  const canSubmit =
    Boolean(localSign?.canClientSign) &&
    consent &&
    otp.trim().length >= 6 &&
    !disabled &&
    !busy;

  const status = localSign?.status ?? "none";

  async function ensurePublished(): Promise<ConsultingAgreementSignView | null> {
    if (localSign?.versionId) return localSign;
    const res = await fetch("/api/client/agreement/publish", { method: "POST" });
    const json = (await res.json()) as {
      sign?: ConsultingAgreementSignView;
      error?: { code?: string };
    };
    if (!res.ok || !json.sign) {
      setErrorCode(json.error?.code ?? "INTERNAL");
      return null;
    }
    setLocalSign(json.sign);
    setCooldown(json.sign.otpCooldownSeconds);
    onSigned?.(json.sign);
    return json.sign;
  }

  async function requestOtp() {
    setBusy(true);
    setMessage(null);
    setErrorCode(null);
    try {
      const current = await ensurePublished();
      if (!current) return;
      const res = await fetch("/api/client/agreement/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: current.versionId,
          consent: true,
        }),
      });
      const json = (await res.json()) as {
        otpCooldownSeconds?: number;
        error?: { code?: string };
      };
      if (!res.ok) {
        setErrorCode(json.error?.code ?? "INTERNAL");
        return;
      }
      setCooldown(json.otpCooldownSeconds ?? 60);
      setMessage(t("otpSent"));
    } finally {
      setBusy(false);
    }
  }

  async function submitSign() {
    if (!localSign) return;
    setBusy(true);
    setMessage(null);
    setErrorCode(null);
    try {
      const res = await fetch("/api/client/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: localSign.versionId,
          otp: otp.trim(),
          consent: true,
        }),
      });
      const json = (await res.json()) as {
        sign?: ConsultingAgreementSignView;
        error?: { code?: string };
      };
      if (!res.ok || !json.sign) {
        setErrorCode(json.error?.code ?? "INTERNAL");
        return;
      }
      setLocalSign(json.sign);
      setMessage(t("signedSuccess"));
      onSigned?.(json.sign);
    } finally {
      setBusy(false);
    }
  }

  const pdfHref = useMemo(() => {
    if (!localSign?.versionId) return null;
    const kind = localSign.status === "completed" ? "final" : "source";
    return `/api/client/agreement/pdf?versionId=${encodeURIComponent(localSign.versionId)}&kind=${kind}&download=1`;
  }, [localSign]);

  const viewHref = useMemo(() => {
    if (!localSign?.versionId) return null;
    const kind = localSign.status === "completed" ? "final" : "source";
    return `/api/client/agreement/pdf?versionId=${encodeURIComponent(localSign.versionId)}&kind=${kind}`;
  }, [localSign]);

  useEffect(() => {
    if (!viewHref) {
      setPdfObjectUrl(null);
      setPdfError(null);
      return;
    }
    const pdfUrl = viewHref;
    let cancelled = false;
    let objectUrl: string | null = null;
    setPdfError(null);
    async function loadPdf() {
      try {
        const res = await fetch(pdfUrl, { cache: "no-store" });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as {
            error?: { code?: string };
          } | null;
          if (!cancelled) {
            setPdfError(json?.error?.code ?? "INTERNAL");
          }
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPdfObjectUrl(objectUrl);
      } catch {
        if (!cancelled) setPdfError("INTERNAL");
      }
    }
    void loadPdf();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [viewHref]);

  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.meta}>
        {localSign && localSign.versionNumber > 1 ? (
          <p>
            {t("version")}: {localSign.versionNumber}
          </p>
        ) : null}
        <p className={styles.status}>{t(`status.${statusKey(status)}`)}</p>
      </div>

      {pdfObjectUrl ? (
        <div className={styles.viewerWrap}>
          <iframe
            src={pdfObjectUrl}
            className={styles.viewer}
            title={t("viewPdf")}
          />
        </div>
      ) : pdfError ? (
        <p className={styles.error} role="alert">
          {(() => {
            try {
              return t(`errors.${pdfError}` as never);
            } catch {
              return t("errors.INTERNAL");
            }
          })()}
        </p>
      ) : null}

      {canStartClientSign ? (
        <div className={styles.form}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={consent}
              disabled={disabled || busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>{t("consent")}</span>
          </label>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!canRequestOtp}
              onClick={() => void requestOtp()}
            >
              {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("requestOtp")}
            </button>
          </div>
          <label className={styles.field}>
            <span>{t("otpLabel")}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              disabled={disabled || busy}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canSubmit}
            onClick={() => void submitSign()}
          >
            {busy ? t("working") : t("signAgreement")}
          </button>
        </div>
      ) : null}

      {localSign &&
      (localSign.status === "client_signed" ||
        localSign.status === "provider_signed" ||
        localSign.status === "completed") ? (
        <div className={styles.done}>
          <p>
            {t("clientSignedAt")}: {formatSignedAt(localSign.clientSignedAt, locale)}
          </p>
          {localSign.providerSignedAt ? (
            <p>
              {t("providerSignedAt")}: {formatSignedAt(localSign.providerSignedAt, locale)}
            </p>
          ) : (
            <p>{t("awaitingProvider")}</p>
          )}
        </div>
      ) : null}

      {viewHref ? (
        <div className={styles.actions}>
          <a className={styles.secondaryBtn} href={viewHref} target="_blank" rel="noreferrer">
            {t("viewPdf")}
          </a>
          {pdfHref ? (
            <a className={styles.secondaryBtn} href={pdfHref}>
              {t("downloadPdf")}
            </a>
          ) : null}
        </div>
      ) : null}

      {message ? <p className={styles.message}>{message}</p> : null}
      {errorCode ? (
        <p className={styles.error} role="alert">
          {(() => {
            try {
              return t(`errors.${errorCode}` as never);
            } catch {
              return t("errors.INTERNAL");
            }
          })()}
        </p>
      ) : null}
    </section>
  );
}
