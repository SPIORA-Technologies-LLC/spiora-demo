"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/providers/SessionProvider";
import { Card } from "@/components/ui/Card";
import styles from "./ClientInvitationsPanel.module.css";

type Invitation = {
  id: string;
  email: string;
  firstName: string | null;
  preferredLocale: string;
  serviceType: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  state: "pending" | "accepted" | "expired" | "revoked";
};

type Assignee = {
  id: string;
  name: string;
  role: "owner" | "manager";
};

type StateFilter = "all" | "pending" | "accepted";

type IssuedCredentials = {
  email: string;
  inviteUrl: string;
  temporaryPassword: string;
  titleKey: "createdTitle" | "resetTitle";
};

function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ClientInvitationsPanel() {
  const t = useTranslations("clientInvitations");
  const locale = useLocale();
  const session = useSession();
  const [items, setItems] = useState<Invitation[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<StateFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<"ru" | "en">("ru");
  const [serviceType, setServiceType] = useState("residence_permit");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/client-invitations", { cache: "no-store" });
      if (!res.ok) throw new Error("fail");
      const data = (await res.json()) as { invitations: Invitation[] };
      setItems(data.invitations ?? []);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssignees = useCallback(async () => {
    setAssigneesLoading(true);
    try {
      const res = await fetch("/api/client-invitations/assignees", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fail");
      const data = (await res.json()) as { assignees: Assignee[] };
      setAssignees(data.assignees ?? []);
      return data.assignees ?? [];
    } catch {
      setAssignees([]);
      return [];
    } finally {
      setAssigneesLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.state === filter);
  }, [items, filter]);

  function serviceLabel(value: string | null): string {
    if (!value) return "—";
    if (value === "residence_permit") return t("services.residence_permit");
    if (value === "consultation") return t("services.consultation");
    if (value === "other") return t("services.other");
    return value;
  }

  function buildSharePackage(creds: IssuedCredentials, nameHint?: string) {
    const cleanedName = nameHint?.trim();
    let url = creds.inviteUrl;
    if (cleanedName) {
      try {
        const parsed = new URL(creds.inviteUrl, window.location.origin);
        parsed.searchParams.set("firstName", cleanedName);
        url = parsed.toString();
      } catch {
        // keep original
      }
    }
    return t("sharePackage", {
      url,
      email: creds.email,
      password: creds.temporaryPassword,
    });
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!assignedTo) {
      setFormError(t("errors.assigneeRequired"));
      return;
    }
    setSaving(true);
    setIssued(null);
    setCopyDone(false);
    const requestId = newRequestId();
    try {
      const res = await fetch("/api/client-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({
          email,
          firstName: firstName.trim() || null,
          preferredLocale,
          serviceType,
          assignedTo,
          expiresInDays,
          requestId,
        }),
      });
      const data = (await res.json()) as {
        inviteUrl?: string;
        temporaryPassword?: string;
        invitation?: { email: string };
        reused?: boolean;
        error?: { message: string; code?: string };
      };
      if (!res.ok) {
        if (data.error?.code === "ASSIGNEE_REQUIRED") {
          setFormError(t("errors.assigneeRequired"));
        } else if (data.error?.code === "AUTH_PROVISION_FAILED") {
          setFormError(t("errors.authProvisionFailed"));
        } else {
          setFormError(data.error?.message || t("errors.createFailed"));
        }
        return;
      }
      if (data.inviteUrl && data.temporaryPassword) {
        let inviteUrl = data.inviteUrl;
        const cleanedName = firstName.trim();
        if (cleanedName) {
          try {
            const url = new URL(data.inviteUrl, window.location.origin);
            url.searchParams.set("firstName", cleanedName);
            inviteUrl = url.toString();
          } catch {
            // keep original
          }
        }
        setIssued({
          email: data.invitation?.email ?? email.trim(),
          inviteUrl,
          temporaryPassword: data.temporaryPassword,
          titleKey: "createdTitle",
        });
      } else if (data.reused) {
        setFormError(t("errors.reusedNoUrl"));
      } else {
        setFormError(t("errors.createFailed"));
      }
      await load();
    } catch {
      setFormError(t("errors.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/client-invitations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function onResetPassword(row: Invitation) {
    if (!window.confirm(t("confirmResetPassword"))) return;
    setResettingId(row.id);
    setFormError(null);
    try {
      const res = await fetch(
        `/api/client-invitations/${encodeURIComponent(row.id)}/reset-password`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const data = (await res.json()) as {
        email?: string;
        inviteUrl?: string;
        temporaryPassword?: string;
        error?: { message: string; code?: string };
      };
      if (!res.ok || !data.temporaryPassword || !data.inviteUrl || !data.email) {
        setModalOpen(true);
        setIssued(null);
        setFormError(
          data.error?.code === "AUTH_PROVISION_FAILED"
            ? t("errors.authProvisionFailed")
            : t("errors.resetFailed"),
        );
        return;
      }
      setModalOpen(true);
      setCopyDone(false);
      setFormError(null);
      setIssued({
        email: data.email,
        inviteUrl: data.inviteUrl,
        temporaryPassword: data.temporaryPassword,
        titleKey: "resetTitle",
      });
      await load();
    } catch {
      setModalOpen(true);
      setIssued(null);
      setFormError(t("errors.resetFailed"));
    } finally {
      setResettingId(null);
    }
  }

  async function copySharePackage() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(
        buildSharePackage(issued, firstName),
      );
      setCopyDone(true);
    } catch {
      setCopyDone(false);
    }
  }

  async function openModal(prefillEmail?: string, prefillFirstName?: string | null) {
    setModalOpen(true);
    setIssued(null);
    setCopyDone(false);
    setFormError(null);
    setEmail(prefillEmail ?? "");
    setFirstName(prefillFirstName?.trim() ?? "");
    setPreferredLocale(locale === "en" ? "en" : "ru");
    setServiceType("residence_permit");
    setExpiresInDays(7);
    const list = await loadAssignees();
    const defaultId =
      list.find((a) => a.id === session.id)?.id ??
      list.find((a) => a.role === session.role && a.name === session.name)?.id ??
      list[0]?.id ??
      "";
    setAssignedTo(defaultId);
  }

  return (
    <Card className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.intro}>
          <p className={styles.subtitle}>{t("subtitle")}</p>
          <p className={styles.statusHint}>{t("statusHint")}</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => void openModal()}>
          {t("inviteClient")}
        </button>
      </div>

      <div className={styles.filters}>
        {(["all", "pending", "accepted"] as StateFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? styles.chipActive : styles.chip}
            onClick={() => setFilter(key)}
          >
            {t(`states.${key}`)}
          </button>
        ))}
      </div>

      {loading ? <p className={styles.muted}>{t("loading")}</p> : null}
      {error ? <p className={styles.error}>{t("errors.loadFailed")}</p> : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className={styles.muted}>{t("empty")}</p>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("columns.name")}</th>
                <th>{t("columns.email")}</th>
                <th>{t("columns.program")}</th>
                <th>{t("columns.assignee")}</th>
                <th>{t("columns.created")}</th>
                <th>{t("columns.expires")}</th>
                <th>{t("columns.status")}</th>
                <th>{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.firstName || "—"}</td>
                  <td>{row.email}</td>
                  <td>{serviceLabel(row.serviceType)}</td>
                  <td>{row.assignedToName || "—"}</td>
                  <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                  <td>{new Date(row.expiresAt).toLocaleString(locale)}</td>
                  <td>
                    <span className={styles.state}>{t(`states.${row.state}`)}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        disabled={resettingId === row.id}
                        onClick={() => void onResetPassword(row)}
                      >
                        {resettingId === row.id ? "…" : t("resendPassword")}
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => void openModal(row.email, row.firstName)}
                      >
                        {t("inviteAgain")}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        disabled={deletingId === row.id}
                        onClick={() => void onDelete(row.id)}
                      >
                        {deletingId === row.id ? "…" : t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 id="invite-modal-title">{t("modalTitle")}</h3>
              <button
                type="button"
                className={styles.close}
                aria-label={t("close")}
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>

            {issued ? (
              <div className={styles.success}>
                <p className={styles.successTitle}>{t(issued.titleKey)}</p>
                <label className={styles.credLabel}>
                  {t("fields.email")}
                  <code className={styles.url}>{issued.email}</code>
                </label>
                <label className={styles.credLabel}>
                  {t("passwordLabel")}
                  <code className={styles.url}>{issued.temporaryPassword}</code>
                </label>
                <label className={styles.credLabel}>
                  {t("linkLabel")}
                  <code className={styles.url}>{issued.inviteUrl}</code>
                </label>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void copySharePackage()}
                >
                  {copyDone ? t("copied") : t("copyMessage")}
                </button>
                <p className={styles.muted}>{t("copyOnceHint")}</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={(e) => void onCreate(e)}>
                {formError ? <p className={styles.error}>{formError}</p> : null}
                <label>
                  {t("fields.email")}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  {t("fields.firstName")}
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </label>
                <label>
                  {t("fields.assignee")}
                  <select
                    required
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    disabled={assigneesLoading || assignees.length === 0}
                  >
                    <option value="">{t("fields.assigneePlaceholder")}</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("fields.service")}
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                  >
                    <option value="residence_permit">
                      {t("services.residence_permit")}
                    </option>
                    <option value="consultation">
                      {t("services.consultation")}
                    </option>
                    <option value="other">{t("services.other")}</option>
                  </select>
                </label>
                <label>
                  {t("fields.locale")}
                  <select
                    value={preferredLocale}
                    onChange={(e) =>
                      setPreferredLocale(e.target.value === "en" ? "en" : "ru")
                    }
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {t("fields.expiresInDays")}
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  />
                </label>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={saving || assigneesLoading || !assignedTo}
                >
                  {saving ? t("creating") : t("create")}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
