"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/providers/SessionProvider";
import { Card } from "@/components/ui/Card";
import styles from "./ClientInvitationsPanel.module.css";

type Invitation = {
  id: string;
  email: string;
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

type StateFilter = "all" | Invitation["state"];

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
  const [assignedTo, setAssignedTo] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<"ru" | "en">("ru");
  const [serviceType, setServiceType] = useState("residence_permit");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!assignedTo) {
      setFormError(t("errors.assigneeRequired"));
      return;
    }
    setSaving(true);
    setCreatedUrl(null);
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
          preferredLocale,
          serviceType,
          assignedTo,
          expiresInDays,
          requestId,
        }),
      });
      const data = (await res.json()) as {
        inviteUrl?: string;
        reused?: boolean;
        error?: { message: string; code?: string };
      };
      if (!res.ok) {
        if (data.error?.code === "ASSIGNEE_REQUIRED") {
          setFormError(t("errors.assigneeRequired"));
        } else {
          setFormError(data.error?.message || t("errors.createFailed"));
        }
        return;
      }
      if (data.inviteUrl) {
        setCreatedUrl(data.inviteUrl);
      } else if (data.reused) {
        setFormError(t("errors.reusedNoUrl"));
      }
      await load();
    } catch {
      setFormError(t("errors.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm(t("confirmRevoke"))) return;
    const res = await fetch(`/api/client-invitations/${id}/revoke`, {
      method: "POST",
    });
    if (res.ok) await load();
  }

  async function copyUrl() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopyDone(true);
    } catch {
      setCopyDone(false);
    }
  }

  async function openModal(prefillEmail?: string) {
    setModalOpen(true);
    setCreatedUrl(null);
    setCopyDone(false);
    setFormError(null);
    setEmail(prefillEmail ?? "");
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
        <div>
          <h2 className={styles.title}>{t("title")}</h2>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => void openModal()}>
          {t("inviteClient")}
        </button>
      </div>

      <div className={styles.filters}>
        {(
          ["all", "pending", "accepted", "expired", "revoked"] as StateFilter[]
        ).map((key) => (
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
                      {row.state === "pending" || row.state === "expired" ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => void onRevoke(row.id)}
                        >
                          {t("revoke")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => void openModal(row.email)}
                      >
                        {t("inviteAgain")}
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

            {createdUrl ? (
              <div className={styles.success}>
                <p className={styles.successTitle}>{t("createdTitle")}</p>
                <code className={styles.url}>{createdUrl}</code>
                <button type="button" className={styles.primaryBtn} onClick={() => void copyUrl()}>
                  {copyDone ? t("copied") : t("copyLink")}
                </button>
                <p className={styles.muted}>{t("copyOnceHint")}</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={(e) => void onCreate(e)}>
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
                {formError ? <p className={styles.error}>{formError}</p> : null}
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
