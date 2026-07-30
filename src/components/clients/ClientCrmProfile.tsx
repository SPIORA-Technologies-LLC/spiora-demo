"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import { translateClientStatus } from "@/i18n/statuses";
import type { Client } from "@/lib/google-sheets/types";
import { Card } from "@/components/ui/Card";
import styles from "./ClientDetailView.module.css";
import editStyles from "./ClientCrmProfile.module.css";

type Source = "postgresql" | "google_sheets" | "demo";

type Props = {
  client: Client;
  source: Source;
  rowIndex?: number;
};

const STATUS_OPTIONS = [
  { value: "New", key: "new" },
  { value: "In progress", key: "in_progress" },
  { value: "Consultation", key: "consultation" },
  { value: "Documents", key: "documents" },
  { value: "Waiting", key: "waiting" },
  { value: "On hold", key: "on_hold" },
  { value: "Completed", key: "completed" },
] as const;

type FormState = {
  name: string;
  email: string;
  phone: string;
  passportNumber: string;
  citizenship: string;
  country: string;
  direction: string;
  status: string;
  manager: string;
  submittedAt: string;
  expectedApprovalAt: string;
  bookingAddress: string;
  bookingRange: string;
  approvalAt: string;
  residenceCardIssuedAt: string;
  appPassword: string;
  partnerName: string;
  contract: string;
  notesSummary: string;
};

function clean(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "—" ? "" : trimmed;
}

function toForm(client: Client): FormState {
  return {
    name: clean(client.name),
    email: clean(client.email),
    phone: clean(client.phone),
    passportNumber: clean(client.passportNumber),
    citizenship: clean(client.citizenship),
    country: clean(client.country),
    direction: clean(client.direction),
    status: clean(client.status) || "New",
    manager: clean(client.referentName ?? client.manager),
    submittedAt: clean(client.submittedAt),
    expectedApprovalAt: clean(client.expectedApprovalAt),
    bookingAddress: clean(client.bookingAddress),
    bookingRange: clean(client.bookingRange),
    approvalAt: clean(client.approvalAt),
    residenceCardIssuedAt: clean(client.residenceCardIssuedAt),
    appPassword: clean(client.appPassword),
    partnerName: clean(client.partnerName),
    contract: clean(client.contract),
    notesSummary: clean(client.notes),
  };
}

function display(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "—" ? trimmed : "—";
}

export function ClientCrmProfile({ client, source, rowIndex }: Props) {
  const t = useTranslations("clients.detail");
  const tFields = useTranslations("clients.fields");
  const tEdit = useTranslations("clients.edit");
  const tCreate = useTranslations("clients.create");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const canEdit = source === "postgresql";

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(client));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewClient, setViewClient] = useState(client);

  const statusLabel = useMemo(
    () => translateClientStatus(locale, viewClient.status),
    [locale, viewClient.status],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit() {
    setForm(toForm(viewClient));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setForm(toForm(viewClient));
    setError(null);
    setEditing(false);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(tEdit("errors.nameRequired"));
      return;
    }

    const referent = form.manager.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(viewClient.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          passportNumber: form.passportNumber.trim(),
          citizenship: form.citizenship.trim(),
          country: form.country.trim(),
          direction: form.direction.trim(),
          status: form.status.trim() || "New",
          manager: referent,
          referentName: referent,
          submittedAt: form.submittedAt.trim(),
          expectedApprovalAt: form.expectedApprovalAt.trim(),
          bookingAddress: form.bookingAddress.trim(),
          bookingRange: form.bookingRange.trim(),
          approvalAt: form.approvalAt.trim(),
          residenceCardIssuedAt: form.residenceCardIssuedAt.trim(),
          appPassword: form.appPassword.trim(),
          partnerName: form.partnerName.trim(),
          contract: form.contract.trim(),
          notesSummary: form.notesSummary.trim(),
        }),
      });
      const data = (await res.json()) as { client?: Client; error?: string };
      if (!res.ok || !data.client) {
        if (res.status === 503) setError(tEdit("errors.storageUnavailable"));
        else if (res.status === 403) setError(tEdit("errors.forbidden"));
        else setError(data.error || tEdit("errors.saveFailed"));
        return;
      }
      setViewClient(data.client);
      setEditing(false);
      router.refresh();
    } catch {
      setError(tEdit("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={editStyles.toolbar}>
        <div className={styles.summary}>
          {!editing ? (
            <>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("fullName")}</span>
                <span className={styles.fieldValue}>{viewClient.name}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("passport")}</span>
                <span className={styles.fieldValue}>
                  {viewClient.passportNumber ?? viewClient.id}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("status")}</span>
                <span className={styles.fieldValue}>
                  <span className={styles.statusBadge}>{statusLabel}</span>
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("source")}</span>
                <span className={styles.fieldValue}>
                  {source === "postgresql"
                    ? t("sourcePostgresql")
                    : source === "google_sheets"
                      ? t("sourceSheets")
                      : t("sourceDemo")}
                  {rowIndex ? ` · ${t("rowIndex", { index: rowIndex })}` : null}
                </span>
              </div>
            </>
          ) : (
            <p className={editStyles.editHint}>{tEdit("hint")}</p>
          )}
        </div>

        {canEdit ? (
          <div className={editStyles.actions}>
            {!editing ? (
              <button type="button" className={editStyles.primary} onClick={startEdit}>
                {tEdit("edit")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className={styles.panel}>
        <div className={editStyles.panelHead}>
          <h2 className={styles.panelTitle}>{t("sheetData")}</h2>
          {editing ? (
            <div className={editStyles.inlineActions}>
              <button
                type="button"
                className={editStyles.secondary}
                disabled={saving}
                onClick={cancelEdit}
              >
                {tEdit("cancel")}
              </button>
              <button
                type="submit"
                form="client-crm-edit-form"
                className={editStyles.primary}
                disabled={saving}
              >
                {saving ? tEdit("saving") : tEdit("save")}
              </button>
            </div>
          ) : null}
        </div>

        {editing ? (
          <form
            id="client-crm-edit-form"
            className={editStyles.form}
            onSubmit={(e) => void onSave(e)}
          >
            <label>
              {t("fullName")}
              <input
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </label>
            <div className={editStyles.row}>
              <label>
                {tFields("email")}
                <input
                  type="email"
                  maxLength={320}
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </label>
              <label>
                {tEdit("fields.phone")}
                <input
                  type="tel"
                  maxLength={64}
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </label>
            </div>
            <label>
              {tFields("passport")}
              <input
                maxLength={64}
                value={form.passportNumber}
                onChange={(e) => updateField("passportNumber", e.target.value)}
              />
            </label>
            <div className={editStyles.row}>
              <label>
                {tEdit("fields.citizenship")}
                <input
                  maxLength={200}
                  value={form.citizenship}
                  onChange={(e) => updateField("citizenship", e.target.value)}
                />
              </label>
              <label>
                {tEdit("fields.country")}
                <input
                  maxLength={200}
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                />
              </label>
            </div>
            <div className={editStyles.row}>
              <label>
                {tEdit("fields.direction")}
                <input
                  maxLength={200}
                  value={form.direction}
                  onChange={(e) => updateField("direction", e.target.value)}
                />
              </label>
              <label>
                {t("status")}
                <select
                  value={
                    STATUS_OPTIONS.some((o) => o.value === form.status)
                      ? form.status
                      : form.status || "New"
                  }
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  {!STATUS_OPTIONS.some((o) => o.value === form.status) &&
                  form.status ? (
                    <option value={form.status}>{form.status}</option>
                  ) : null}
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {translateClientStatus(locale, option.value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={editStyles.row}>
              <label>
                {tFields("submittedAt")}
                <input
                  maxLength={64}
                  value={form.submittedAt}
                  onChange={(e) => updateField("submittedAt", e.target.value)}
                  placeholder={tCreate("fields.datePlaceholder")}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
              <label>
                {tFields("expectedApproval")}
                <input
                  maxLength={64}
                  value={form.expectedApprovalAt}
                  onChange={(e) =>
                    updateField("expectedApprovalAt", e.target.value)
                  }
                  placeholder={tCreate("fields.datePlaceholder")}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
            </div>

            <label>
              {tFields("referent")}
              <input
                maxLength={200}
                value={form.manager}
                onChange={(e) => updateField("manager", e.target.value)}
              />
            </label>

            <label>
              {tFields("bookingAddress")}
              <input
                maxLength={500}
                value={form.bookingAddress}
                onChange={(e) => updateField("bookingAddress", e.target.value)}
              />
            </label>

            <div className={editStyles.row}>
              <label>
                {tFields("bookingRange")}
                <input
                  maxLength={120}
                  value={form.bookingRange}
                  onChange={(e) => updateField("bookingRange", e.target.value)}
                  placeholder={tCreate("fields.bookingDatePlaceholder")}
                  autoComplete="off"
                />
              </label>
              <label>
                {tFields("approvalDate")}
                <input
                  maxLength={64}
                  value={form.approvalAt}
                  onChange={(e) => updateField("approvalAt", e.target.value)}
                  placeholder={tCreate("fields.datePlaceholder")}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
            </div>

            <div className={editStyles.row}>
              <label>
                {tFields("cardIssuedDate")}
                <input
                  maxLength={64}
                  value={form.residenceCardIssuedAt}
                  onChange={(e) =>
                    updateField("residenceCardIssuedAt", e.target.value)
                  }
                  placeholder={tCreate("fields.datePlaceholder")}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
              <label>
                {tFields("appPassword")}
                <input
                  maxLength={200}
                  value={form.appPassword}
                  onChange={(e) => updateField("appPassword", e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className={editStyles.row}>
              <label>
                {tFields("partner")}
                <input
                  maxLength={200}
                  value={form.partnerName}
                  onChange={(e) => updateField("partnerName", e.target.value)}
                />
              </label>
              <label>
                {tFields("contract")}
                <input
                  maxLength={200}
                  value={form.contract}
                  onChange={(e) => updateField("contract", e.target.value)}
                />
              </label>
            </div>

            <label>
              {tFields("notes")}
              <textarea
                maxLength={2000}
                rows={3}
                value={form.notesSummary}
                onChange={(e) => updateField("notesSummary", e.target.value)}
              />
            </label>
            {error ? <p className={editStyles.error}>{error}</p> : null}
          </form>
        ) : (
          <div className={styles.fieldGrid}>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("lastName")}</span>
              <span className={styles.fieldValue}>{display(viewClient.name)}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tEdit("fields.citizenship")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.citizenship)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("passport")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.passportNumber ?? viewClient.id)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("email")}</span>
              <span className={styles.fieldValue}>{display(viewClient.email)}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tEdit("fields.phone")}</span>
              <span className={styles.fieldValue}>{display(viewClient.phone)}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tEdit("fields.country")}</span>
              <span className={styles.fieldValue}>{display(viewClient.country)}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tEdit("fields.direction")}</span>
              <span className={styles.fieldValue}>{display(viewClient.direction)}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("submittedAt")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.submittedAt ?? viewClient.createdAt)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("expectedApproval")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.expectedApprovalAt)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("referent")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.referentName ?? viewClient.manager)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("bookingAddress")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.bookingAddress)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("bookingRange")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.bookingRange)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("approvalDate")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.approvalAt)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("cardIssuedDate")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.residenceCardIssuedAt)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("appPassword")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.appPassword)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("partner")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.partnerName)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("contract")}</span>
              <span className={styles.fieldValue}>
                {display(viewClient.contract)}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{tFields("notes")}</span>
              <span className={styles.fieldValue}>{display(viewClient.notes)}</span>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
