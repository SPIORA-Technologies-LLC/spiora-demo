"use client";

import { useState, type FormEvent } from "react";
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
  notesSummary: "",
};

export function CreateClientModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations("clients.create");
  const router = useRouter();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          passportNumber: form.passportNumber.trim() || undefined,
          citizenship: form.citizenship.trim() || undefined,
          country: form.country.trim() || undefined,
          direction: form.direction.trim() || undefined,
          serviceType: form.serviceType.trim() || undefined,
          notesSummary: form.notesSummary.trim() || undefined,
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

  return (
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
          <label>
            {t("fields.notes")}
            <textarea
              maxLength={2000}
              rows={3}
              value={form.notesSummary}
              onChange={(e) => updateField("notesSummary", e.target.value)}
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

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
    </div>
  );
}
