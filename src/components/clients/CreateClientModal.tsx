"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Client } from "@/lib/google-sheets/types";
import styles from "./CreateClientModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
};

const INITIAL = {
  name: "",
  email: "",
  phone: "",
  passportNumber: "",
  citizenship: "",
  country: "",
  direction: "",
  serviceType: "",
  submittedAt: "",
  expectedApprovalAt: "",
  referentName: "",
  bookingAddress: "",
  bookingRange: "",
  approvalAt: "",
  residenceCardIssuedAt: "",
  appPassword: "",
  partnerName: "",
  contract: "",
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function CreateClientModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations("clients.create");
  const router = useRouter();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  function updateField(key: keyof typeof INITIAL, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("errors.nameRequired"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: optional(form.email),
          phone: optional(form.phone),
          passportNumber: optional(form.passportNumber),
          citizenship: optional(form.citizenship),
          country: optional(form.country),
          direction: optional(form.direction),
          serviceType: optional(form.serviceType),
          submittedAt: optional(form.submittedAt),
          expectedApprovalAt: optional(form.expectedApprovalAt),
          referentName: optional(form.referentName),
          manager: optional(form.referentName),
          bookingAddress: optional(form.bookingAddress),
          bookingRange: optional(form.bookingRange),
          approvalAt: optional(form.approvalAt),
          residenceCardIssuedAt: optional(form.residenceCardIssuedAt),
          appPassword: optional(form.appPassword),
          partnerName: optional(form.partnerName),
          contract: optional(form.contract),
          status: "New",
          pipelineStage: "Intake",
        }),
      });
      const data = (await res.json()) as {
        client?: Client;
        error?: string;
      };
      if (!res.ok || !data.client) {
        if (res.status === 503) {
          setError(t("errors.storageUnavailable"));
        } else if (res.status === 403) {
          setError(t("errors.forbidden"));
        } else {
          setError(data.error || t("errors.createFailed"));
        }
        return;
      }

      const created = data.client;
      setForm(INITIAL);
      onCreated(created);
      onClose();
      router.push(`/clients/${encodeURIComponent(created.id)}`);
    } catch {
      setError(t("errors.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-client-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id="create-client-title">{t("title")}</h3>
          <button
            type="button"
            className={styles.close}
            aria-label={t("close")}
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <div className={styles.formBody}>
          <label>
            {t("fields.name")}
            <input
              required
              maxLength={200}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              autoComplete="name"
            />
          </label>
          <div className={styles.row}>
            <label>
              {t("fields.email")}
              <input
                type="email"
                maxLength={320}
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              {t("fields.phone")}
              <input
                type="tel"
                maxLength={64}
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                autoComplete="tel"
              />
            </label>
          </div>
          <label>
            {t("fields.passport")}
            <input
              maxLength={64}
              value={form.passportNumber}
              onChange={(e) => updateField("passportNumber", e.target.value)}
            />
          </label>
          <div className={styles.row}>
            <label>
              {t("fields.citizenship")}
              <input
                maxLength={200}
                value={form.citizenship}
                onChange={(e) => updateField("citizenship", e.target.value)}
              />
            </label>
            <label>
              {t("fields.country")}
              <input
                maxLength={200}
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
              />
            </label>
          </div>
          <div className={styles.row}>
            <label>
              {t("fields.direction")}
              <input
                maxLength={200}
                value={form.direction}
                onChange={(e) => updateField("direction", e.target.value)}
                placeholder={t("fields.directionPlaceholder")}
              />
            </label>
            <label>
              {t("fields.serviceType")}
              <input
                maxLength={200}
                value={form.serviceType}
                onChange={(e) => updateField("serviceType", e.target.value)}
                placeholder={t("fields.servicePlaceholder")}
              />
            </label>
          </div>

          <div className={styles.row}>
            <label>
              {t("fields.submittedAt")}
              <input
                maxLength={64}
                value={form.submittedAt}
                onChange={(e) => updateField("submittedAt", e.target.value)}
                placeholder={t("fields.datePlaceholder")}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
            <label>
              {t("fields.expectedApproval")}
              <input
                maxLength={64}
                value={form.expectedApprovalAt}
                onChange={(e) =>
                  updateField("expectedApprovalAt", e.target.value)
                }
                placeholder={t("fields.datePlaceholder")}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
          </div>

          <label>
            {t("fields.referent")}
            <input
              maxLength={200}
              value={form.referentName}
              onChange={(e) => updateField("referentName", e.target.value)}
            />
          </label>

          <label>
            {t("fields.bookingAddress")}
            <input
              maxLength={500}
              value={form.bookingAddress}
              onChange={(e) => updateField("bookingAddress", e.target.value)}
            />
          </label>

          <div className={styles.row}>
            <label>
              {t("fields.bookingDate")}
              <input
                maxLength={120}
                value={form.bookingRange}
                onChange={(e) => updateField("bookingRange", e.target.value)}
                placeholder={t("fields.bookingDatePlaceholder")}
                autoComplete="off"
              />
            </label>
            <label>
              {t("fields.approvalDate")}
              <input
                maxLength={64}
                value={form.approvalAt}
                onChange={(e) => updateField("approvalAt", e.target.value)}
                placeholder={t("fields.datePlaceholder")}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
          </div>

          <div className={styles.row}>
            <label>
              {t("fields.cardIssuedDate")}
              <input
                maxLength={64}
                value={form.residenceCardIssuedAt}
                onChange={(e) =>
                  updateField("residenceCardIssuedAt", e.target.value)
                }
                placeholder={t("fields.datePlaceholder")}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
            <label>
              {t("fields.appPassword")}
              <input
                maxLength={200}
                value={form.appPassword}
                onChange={(e) => updateField("appPassword", e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>

          <div className={styles.row}>
            <label>
              {t("fields.partner")}
              <input
                maxLength={200}
                value={form.partnerName}
                onChange={(e) => updateField("partnerName", e.target.value)}
              />
            </label>
            <label>
              {t("fields.contract")}
              <input
                maxLength={200}
                value={form.contract}
                onChange={(e) => updateField("contract", e.target.value)}
              />
              </label>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={saving}
              onClick={onClose}
            >
              {t("cancel")}
            </button>
            <button type="submit" className={styles.primary} disabled={saving}>
              {saving ? t("saving") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
