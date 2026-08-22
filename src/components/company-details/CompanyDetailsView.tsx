"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Toast } from "@/components/tasks/Toast";
import type { ToastMessage } from "@/components/tasks/Toast";
import type { CompanyDetailsView } from "@/lib/company-details/types";
import {
  formatAddressCopyText,
  formatCompanyDetailsCopyText,
} from "@/lib/company-details/copy-formatter";
import { formatAddressBlock } from "@/lib/company-details/validation";
import styles from "./CompanyDetailsView.module.css";

type FormState = Omit<
  CompanyDetailsView,
  "id" | "isDemo" | "version" | "createdAt" | "updatedAt" | "updatedBy" | "canManage"
>;

function toFormState(details: CompanyDetailsView): FormState {
  return {
    companyName: details.companyName,
    tradingName: details.tradingName,
    registrationNumber: details.registrationNumber,
    vatNumber: details.vatNumber,
    addressLine1: details.addressLine1,
    addressLine2: details.addressLine2,
    city: details.city,
    postalCode: details.postalCode,
    country: details.country,
    generalEmail: details.generalEmail,
    financeEmail: details.financeEmail,
    phone: details.phone,
    website: details.website,
    bankAccountHolder: details.bankAccountHolder,
    bankName: details.bankName,
    iban: details.iban,
    swiftBic: details.swiftBic,
    currency: details.currency,
  };
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export function CompanyDetailsView() {
  const t = useTranslations("companyDetails");
  const [details, setDetails] = useState<CompanyDetailsView | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/company-details", { cache: "no-store" });
      const json = (await res.json()) as {
        details?: CompanyDetailsView;
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.details) {
        throw new Error(json.error ?? t("loadFailed"));
      }
      setDetails(json.details);
      setForm(toFormState(json.details));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const addressDisplay = useMemo(
    () => (details ? formatAddressBlock(details) : ""),
    [details],
  );

  async function handleCopy(key: string, text: string, toastKey: string) {
    await copyText(text);
    setCopiedKey(key);
    setToast({ text: t(toastKey as never) });
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  function startEditing() {
    if (!details) return;
    setForm(toFormState(details));
    setEditing(true);
  }

  function cancelEditing() {
    if (details) setForm(toFormState(details));
    setEditing(false);
  }

  async function saveChanges() {
    if (!details || !form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expectedVersion: details.version }),
      });
      const json = (await res.json()) as {
        details?: CompanyDetailsView;
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.details) {
        throw new Error(json.error ?? t("saveFailed"));
      }
      setDetails(json.details);
      setForm(toFormState(json.details));
      setEditing(false);
      setToast({ text: t("saved") });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
      setToast({
        text: err instanceof Error ? err.message : t("saveFailed"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading) {
    return <p className={styles.meta}>{t("loading")}</p>;
  }

  if (error && !details) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!details || !form) {
    return null;
  }

  return (
    <div className={styles.page}>
      <SectionHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void handleCopy("all", formatCompanyDetailsCopyText(details), "copiedAll")
              }
            >
              {t("copyAll")}
            </Button>
            {details.canManage ? (
              editing ? (
                <>
                  <Button type="button" variant="secondary" onClick={cancelEditing}>
                    {t("cancel")}
                  </Button>
                  <Button type="button" onClick={() => void saveChanges()} disabled={saving}>
                    {saving ? t("saving") : t("saveChanges")}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={startEditing}>
                  {t("edit")}
                </Button>
              )
            ) : null}
          </div>
        }
      />

      {details.isDemo ? (
        <div className={styles.demoBanner} role="note">
          <p className={styles.demoTitle}>{t("demoBannerTitle")}</p>
          <p className={styles.demoText}>{t("demoBannerText")}</p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {editing ? (
        <div className={styles.editForm}>
          <section className={styles.formSection}>
            <h2>{t("sections.company")}</h2>
            <div className={styles.formGrid}>
              {(
                [
                  ["companyName", "fields.companyName"],
                  ["tradingName", "fields.tradingName"],
                  ["registrationNumber", "fields.registrationNumber"],
                  ["vatNumber", "fields.vatNumber"],
                  ["country", "fields.country"],
                  ["currency", "fields.currency"],
                ] as const
              ).map(([key, labelKey]) => (
                <label key={key} className={styles.field}>
                  <span>{t(labelKey)}</span>
                  <input
                    value={form[key]}
                    onChange={(event) => updateField(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>{t("sections.address")}</h2>
            <div className={styles.formGrid}>
              {(
                [
                  ["addressLine1", "fields.addressLine1"],
                  ["addressLine2", "fields.addressLine2"],
                  ["city", "fields.city"],
                  ["postalCode", "fields.postalCode"],
                  ["country", "fields.country"],
                ] as const
              ).map(([key, labelKey]) => (
                <label key={key} className={styles.field}>
                  <span>{t(labelKey)}</span>
                  <input
                    value={form[key]}
                    onChange={(event) => updateField(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>{t("sections.contact")}</h2>
            <div className={styles.formGrid}>
              {(
                [
                  ["generalEmail", "fields.generalEmail"],
                  ["financeEmail", "fields.financeEmail"],
                  ["phone", "fields.phone"],
                  ["website", "fields.website"],
                ] as const
              ).map(([key, labelKey]) => (
                <label key={key} className={styles.field}>
                  <span>{t(labelKey)}</span>
                  <input
                    value={form[key]}
                    onChange={(event) => updateField(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>{t("sections.bank")}</h2>
            <div className={styles.formGrid}>
              {(
                [
                  ["bankAccountHolder", "fields.bankAccountHolder"],
                  ["bankName", "fields.bankName"],
                  ["iban", "fields.iban"],
                  ["swiftBic", "fields.swiftBic"],
                  ["currency", "fields.currency"],
                ] as const
              ).map(([key, labelKey]) => (
                <label key={key} className={styles.field}>
                  <span>{t(labelKey)}</span>
                  <input
                    value={form[key]}
                    onChange={(event) => updateField(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>{t("sections.company")}</h2>
            <dl className={styles.list}>
              <div>
                <dt>{t("fields.companyName")}</dt>
                <dd>{details.companyName}</dd>
              </div>
              <div>
                <dt>{t("fields.tradingName")}</dt>
                <dd>{details.tradingName}</dd>
              </div>
              <div>
                <dt>{t("fields.registrationNumber")}</dt>
                <dd>{details.registrationNumber}</dd>
              </div>
              <div>
                <dt>{t("fields.vatNumber")}</dt>
                <dd>{details.vatNumber}</dd>
              </div>
              <div>
                <dt>{t("fields.country")}</dt>
                <dd>{details.country}</dd>
              </div>
              <div>
                <dt>{t("fields.currency")}</dt>
                <dd>{details.currency}</dd>
              </div>
            </dl>
          </Card>

          <Card className={styles.card}>
            <div className={styles.cardHeaderRow}>
              <h2 className={styles.cardTitle}>{t("sections.address")}</h2>
              <Button
                type="button"
                variant="secondary"
                className={styles.inlineCopyBtn}
                onClick={() =>
                  void handleCopy(
                    "address",
                    formatAddressCopyText(details),
                    "copied",
                  )
                }
              >
                {copiedKey === "address" ? t("copied") : t("copy")}
              </Button>
            </div>
            <p className={styles.addressBlock}>{addressDisplay}</p>
          </Card>

          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>{t("sections.contact")}</h2>
            <dl className={styles.list}>
              <div>
                <dt>{t("fields.generalEmail")}</dt>
                <dd className={styles.wrap}>{details.generalEmail}</dd>
              </div>
              <div>
                <dt>{t("fields.financeEmail")}</dt>
                <dd className={styles.wrap}>{details.financeEmail}</dd>
              </div>
              <div>
                <dt>{t("fields.phone")}</dt>
                <dd>{details.phone}</dd>
              </div>
              {details.website ? (
                <div>
                  <dt>{t("fields.website")}</dt>
                  <dd className={styles.wrap}>
                    <a href={details.website} target="_blank" rel="noreferrer">
                      {details.website}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>{t("sections.bank")}</h2>
            <dl className={styles.list}>
              <div>
                <dt>{t("fields.bankAccountHolder")}</dt>
                <dd>{details.bankAccountHolder}</dd>
              </div>
              <div>
                <dt>{t("fields.bankName")}</dt>
                <dd>{details.bankName}</dd>
              </div>
              <div className={styles.copyRow}>
                <div>
                  <dt>{t("fields.iban")}</dt>
                  <dd className={styles.wrap}>{details.iban}</dd>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className={styles.inlineCopyBtn}
                  onClick={() =>
                    void handleCopy("iban", details.iban, "copied")
                  }
                >
                  {copiedKey === "iban" ? t("copied") : t("copy")}
                </Button>
              </div>
              <div className={styles.copyRow}>
                <div>
                  <dt>{t("fields.swiftBic")}</dt>
                  <dd>{details.swiftBic}</dd>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className={styles.inlineCopyBtn}
                  onClick={() =>
                    void handleCopy("swift", details.swiftBic, "copied")
                  }
                >
                  {copiedKey === "swift" ? t("copied") : t("copy")}
                </Button>
              </div>
              <div>
                <dt>{t("fields.currency")}</dt>
                <dd>{details.currency}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
