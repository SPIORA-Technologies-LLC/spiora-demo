"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { ClientCaseFinanceTab } from "@/components/clients/ClientCaseFinanceTab";
import { ConsultingAgreementDocument } from "@/components/client-portal/ConsultingAgreementDocument";
import type { ConsultingAgreementView } from "@/lib/client-portal/consulting-agreement-fields";
import type { ConsultingAgreementSignView } from "@/lib/client-portal/sign-types";
import {
  CLIENT_CASE_STATUSES,
  type ClientCaseStatus,
} from "@/lib/client-portal/case-types";
import {
  caseActivityLabel,
  caseServiceTypeLabel,
  caseStatusLabel,
} from "@/lib/client-portal/case-status-labels";
import styles from "./ClientCaseDetail.module.css";

type ReviewSection = {
  id: string;
  title: string;
  items: Array<{ questionId: string; label: string; value: string }>;
};

type CaseDetailPayload = {
  case: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    serviceType: string | null;
    assignedName: string | null;
    submittedAt: string;
    currentStatus: ClientCaseStatus;
  };
  history: Array<{
    id: string;
    toStatus: ClientCaseStatus;
    fromStatus: ClientCaseStatus | null;
    createdAt: string;
    note: string | null;
  }>;
  comments: Array<{
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>;
  activity: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    actorRole: string;
  }>;
  clientDocuments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    category: string | null;
    createdAt: string;
  }>;
  employeeDocuments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    category: string | null;
    uploadedByName: string | null;
    createdAt: string;
  }>;
  reviewSections: ReviewSection[];
  agreement: (ConsultingAgreementView & {
    sign?: ConsultingAgreementSignView | null;
  }) | null;
};

type AuditPayload = {
  versionId: string;
  transactionId: string;
  events: Array<{
    id: string;
    eventType: string;
    actor: string;
    occurredAt: string;
    documentHash?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }>;
};

type TabId =
  | "overview"
  | "questionnaire"
  | "agreement"
  | "documents"
  | "comments"
  | "status"
  | "history"
  | "finance";

function formatDateTime(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ClientCaseDetail({
  caseId,
  canViewFinance = false,
}: {
  caseId: string;
  canViewFinance?: boolean;
}) {
  const locale = useLocale() as "en" | "ru";
  const t = useTranslations("clientIntake.detail");
  const [tab, setTab] = useState<TabId>("overview");
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<CaseDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<ClientCaseStatus>("application_received");
  const [busy, setBusy] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditPayload | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const statusOptions = useMemo(
    () =>
      CLIENT_CASE_STATUSES.map((value) => ({
        value,
        label: caseStatusLabel(value, locale),
      })),
    [locale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client-cases/${caseId}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as CaseDetailPayload;
      setData(json);
      setStatus(json.case.currentStatus);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitComment() {
    if (!comment.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/client-cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(t("commentFailed"));
      return;
    }
    setComment("");
    await load();
  }

  async function saveStatus() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/client-cases/${caseId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: status }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(t("statusFailed"));
      return;
    }
    setMessage(t("statusSaved"));
    await load();
  }

  async function uploadDocument(file: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    form.set("category", "employee");
    const res = await fetch(`/api/client-cases/${caseId}/documents`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(t("uploadFailed"));
      return;
    }
    await load();
  }

  async function acceptAgreement(accepted: boolean) {
    if (data?.agreement?.sign) {
      if (
        accepted &&
        !window.confirm(t("sign.providerConfirm", { name: data.case.firstName ?? "—" }))
      ) {
        return;
      }
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/client-cases/${caseId}/agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: accepted }),
      });
      setBusy(false);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          code?: string;
        } | null;
        const code = payload?.code;
        setMessage(
          code === "PROVIDER_PERMISSION_REQUIRED" ||
            code === "PROVIDER_MFA_REQUIRED" ||
            code === "DOCUMENT_HASH_MISMATCH" ||
            code === "CONTRACT_WRONG_STATUS" ||
            code === "CONTRACT_CANCELLED" ||
            code === "CONTRACT_SUPERSEDED"
            ? t(`sign.errors.${code}`)
            : t("agreementFailed"),
        );
        return;
      }
      await load();
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/client-cases/${caseId}/agreement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(t("agreementFailed"));
      return;
    }
    const json = (await res.json()) as { agreement: ConsultingAgreementView };
    setData((prev) => (prev ? { ...prev, agreement: json.agreement } : prev));
  }

  async function toggleAudit() {
    if (auditOpen) {
      setAuditOpen(false);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client-cases/${caseId}/agreement/audit`);
      if (!res.ok) {
        setMessage(t("agreementFailed"));
        return;
      }
      const json = (await res.json()) as AuditPayload;
      setAudit(json);
      setAuditOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function auditEventLabel(eventType: string) {
    try {
      return t(`sign.auditLog.events.${eventType}` as never);
    } catch {
      return eventType;
    }
  }

  function auditActorLabel(actor: string) {
    try {
      return t(`sign.auditLog.actors.${actor}` as never);
    } catch {
      return actor;
    }
  }

  async function deleteDocument(doc: { id: string; fileName: string }) {
    if (!window.confirm(t("documents.confirmDelete", { name: doc.fileName }))) {
      return;
    }
    setDeletingDocId(doc.id);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/client-cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(doc.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setMessage(t("documents.deleteFailed"));
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clientDocuments: prev.clientDocuments.filter((item) => item.id !== doc.id),
          employeeDocuments: prev.employeeDocuments.filter(
            (item) => item.id !== doc.id,
          ),
        };
      });
    } catch {
      setMessage(t("documents.deleteFailed"));
    } finally {
      setDeletingDocId(null);
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: t("tabs.overview") },
    { id: "questionnaire", label: t("tabs.questionnaire") },
    { id: "agreement", label: t("tabs.agreement") },
    { id: "documents", label: t("tabs.documents") },
    { id: "comments", label: t("tabs.comments") },
    { id: "status", label: t("tabs.status") },
    { id: "history", label: t("tabs.history") },
    ...(canViewFinance
      ? ([{ id: "finance" as const, label: t("tabs.finance") }] as const)
      : []),
  ];

  useEffect(() => {
    const root = tabsRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>(`[data-tab-id="${tab}"]`);
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [tab]);

  if (loading) return <p>{t("loading")}</p>;
  if (!data) return <p>{t("notFound")}</p>;

  return (
    <div className={styles.page}>
      <Link href="/clients/intake" className={styles.back}>
        ← {t("back")}
      </Link>

      <div className={styles.tabs} role="tablist" aria-label={t("sectionTitle")} ref={tabsRef}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            data-tab-id={item.id}
            className={tab === item.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? <p className={styles.message}>{message}</p> : null}

      {tab === "overview" ? (
        <Card className={styles.panel}>
          <div className={styles.fieldGrid}>
            <div>
              <span className={styles.label}>{t("fields.firstName")}</span>
              <span>{data.case.firstName ?? "—"}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.lastName")}</span>
              <span>{data.case.lastName ?? "—"}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.email")}</span>
              <span>{data.case.email ?? "—"}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.phone")}</span>
              <span>{data.case.phone ?? "—"}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.service")}</span>
              <span>{caseServiceTypeLabel(data.case.serviceType, locale)}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.assignee")}</span>
              <span>{data.case.assignedName ?? "—"}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.submittedAt")}</span>
              <span>{formatDateTime(data.case.submittedAt, locale)}</span>
            </div>
            <div>
              <span className={styles.label}>{t("fields.status")}</span>
              <span>{caseStatusLabel(data.case.currentStatus, locale)}</span>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "questionnaire" ? (
        <div className={styles.stack}>
          {data.reviewSections.length === 0 ? (
            <Card className={styles.panel}>
              <p className={styles.message}>{t("questionnaireEmpty")}</p>
            </Card>
          ) : (
            data.reviewSections.map((section) => (
              <Card key={section.id} className={styles.panel}>
                <h3 className={styles.sectionTitle}>{section.title}</h3>
                <dl className={styles.reviewList}>
                  {section.items.map((item) => (
                    <div key={item.questionId} className={styles.answerRow}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === "agreement" ? (
        <div className={styles.stack}>
          {data.agreement ? (
            <>
              {data.agreement.sign ? (
                <Card className={styles.panel}>
                  <div className={styles.signSummary}>
                    <p
                      className={
                        data.agreement.sign.status === "cancelled"
                          ? `${styles.signStatus} ${styles.signStatusCancelled}`
                          : styles.signStatus
                      }
                    >
                      {t(`sign.status.${data.agreement.sign.status}`)}
                    </p>
                    {data.agreement.sign.versionNumber > 1 ? (
                      <p className={styles.signVersion}>
                        {t("sign.version")} {data.agreement.sign.versionNumber}
                      </p>
                    ) : null}
                    <div className={styles.signParties}>
                      <div className={styles.signParty}>
                        <p className={styles.signPartyLabel}>{t("sign.clientSigner")}</p>
                        <p className={styles.signPartyName}>
                          {data.agreement.sign.clientSignerName ?? "—"}
                        </p>
                        <p className={styles.signPartyDate}>
                          {data.agreement.sign.clientSignedAt
                            ? formatDateTime(data.agreement.sign.clientSignedAt, locale)
                            : "—"}
                        </p>
                      </div>
                      <div className={styles.signParty}>
                        <p className={styles.signPartyLabel}>{t("sign.providerSigner")}</p>
                        <p className={styles.signPartyName}>
                          {data.agreement.sign.providerSignerName ?? "—"}
                        </p>
                        {data.agreement.sign.providerSignerTitle ? (
                          <p className={styles.signPartyRole}>
                            {data.agreement.sign.providerSignerTitle}
                          </p>
                        ) : null}
                        <p className={styles.signPartyDate}>
                          {data.agreement.sign.providerSignedAt
                            ? formatDateTime(data.agreement.sign.providerSignedAt, locale)
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {data.agreement.sign.hasSourcePdf || data.agreement.sign.hasFinalPdf ? (
                    <iframe
                      className={styles.pdfFrame}
                      title={t("sign.viewPdf")}
                      src={`/api/client-cases/${caseId}/agreement/pdf?kind=${
                        data.agreement.sign.hasFinalPdf ? "final" : "source"
                      }`}
                    />
                  ) : null}
                  {data.agreement.sign.canProviderSign ? (
                    <button
                      type="button"
                      className={styles.docActionBtn}
                      disabled={busy}
                      onClick={() => void acceptAgreement(true)}
                    >
                      {t("sign.providerSign")}
                    </button>
                  ) : null}
                  <div className={styles.docActions}>
                    <button
                      type="button"
                      className={styles.docActionBtn}
                      disabled={busy}
                      onClick={() =>
                        void fetch(`/api/client-cases/${caseId}/agreement/new-version`, {
                          method: "POST",
                        }).then(async (res) => {
                          if (!res.ok) {
                            setMessage(t("agreementFailed"));
                            return;
                          }
                          await load();
                        })
                      }
                    >
                      {t("sign.newVersion")}
                    </button>
                    <button
                      type="button"
                      className={styles.docActionBtn}
                      disabled={
                        busy ||
                        data.agreement.sign.status === "cancelled" ||
                        data.agreement.sign.status === "superseded"
                      }
                      onClick={() => {
                        const signed =
                          data.agreement?.sign?.status === "completed" ||
                          data.agreement?.sign?.status === "provider_signed";
                        const confirmed = window.confirm(
                          signed
                            ? t("sign.cancelConfirmCompleted")
                            : t("sign.cancelConfirm"),
                        );
                        if (!confirmed) return;
                        setBusy(true);
                        setMessage(null);
                        void fetch(`/api/client-cases/${caseId}/agreement/cancel`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({}),
                        })
                          .then(async (res) => {
                            const json = (await res.json().catch(() => null)) as {
                              error?: string;
                              code?: string;
                            } | null;
                            if (!res.ok) {
                              const code = json?.code ?? json?.error;
                              if (
                                code === "CONTRACT_WRONG_STATUS" ||
                                code === "CONTRACT_SUPERSEDED" ||
                                code === "CONTRACT_CANCELLED"
                              ) {
                                try {
                                  setMessage(t(`sign.errors.${code}` as never));
                                } catch {
                                  setMessage(t("agreementFailed"));
                                }
                                return;
                              }
                              setMessage(t("agreementFailed"));
                              return;
                            }
                            setMessage(t("sign.cancelSuccess"));
                            setAudit(null);
                            await load();
                            if (auditOpen) {
                              const auditRes = await fetch(
                                `/api/client-cases/${caseId}/agreement/audit`,
                              );
                              if (auditRes.ok) {
                                setAudit((await auditRes.json()) as AuditPayload);
                              }
                            }
                          })
                          .finally(() => setBusy(false));
                      }}
                    >
                      {t("sign.cancelContract")}
                    </button>
                    <button
                      type="button"
                      className={styles.docActionBtn}
                      onClick={() => void toggleAudit()}
                    >
                      {t("sign.audit")}
                    </button>
                  </div>
                  <div className={styles.docActions}>
                    <a
                      className={styles.docActionBtn}
                      href={`/api/client-cases/${caseId}/agreement/pdf?kind=${
                        data.agreement.sign.hasFinalPdf ? "final" : "source"
                      }`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("sign.viewPdf")}
                    </a>
                    <a
                      className={styles.docActionBtn}
                      href={`/api/client-cases/${caseId}/agreement/pdf?kind=${
                        data.agreement.sign.hasFinalPdf ? "final" : "source"
                      }&download=1`}
                    >
                      {t("sign.downloadPdf")}
                    </a>
                  </div>
                  {data.agreement.sign.history && data.agreement.sign.history.length > 1 ? (
                    <div className={`${styles.docList} ${styles.versionHistory}`}>
                      <strong>{t("sign.previousVersions")}</strong>
                      {data.agreement.sign.history.map((item) => (
                        <div key={item.versionId} className={styles.historyItem}>
                          <span>
                            {t("sign.version")} {item.versionNumber} ·{" "}
                            {t(`sign.status.${item.status}`)}
                          </span>
                          {item.hasSourcePdf || item.hasFinalPdf ? (
                            <div className={styles.historyActions}>
                              {item.hasSourcePdf ? (
                                <a
                                  className={styles.docActionBtn}
                                  href={`/api/client-cases/${caseId}/agreement/pdf?kind=source&versionId=${item.versionId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("sign.sourcePdf")}
                                </a>
                              ) : null}
                              {item.hasFinalPdf ? (
                                <a
                                  className={styles.docActionBtn}
                                  href={`/api/client-cases/${caseId}/agreement/pdf?kind=final&versionId=${item.versionId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("sign.finalPdf")}
                                </a>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {auditOpen && audit ? (
                    <div className={styles.auditLog}>
                      <div className={styles.auditLogHeader}>
                        <strong>{t("sign.audit")}</strong>
                        {audit.transactionId ? (
                          <span className={styles.auditMeta}>
                            {t("sign.auditLog.transactionId")}: {audit.transactionId}
                          </span>
                        ) : null}
                      </div>
                      {audit.events.length === 0 ? (
                        <p className={styles.message}>{t("sign.auditLog.empty")}</p>
                      ) : (
                        <ul className={styles.auditList}>
                          {audit.events.map((event) => {
                            const hasTech =
                              Boolean(event.documentHash) ||
                              Boolean(event.ipAddress) ||
                              Boolean(event.userAgent);
                            return (
                              <li key={event.id} className={styles.auditItem}>
                                <p className={styles.auditEventTitle}>
                                  {auditEventLabel(event.eventType)}
                                </p>
                                <p className={styles.auditEventMeta}>
                                  {formatDateTime(event.occurredAt, locale)}
                                  {" · "}
                                  {t("sign.auditLog.by", {
                                    actor: auditActorLabel(event.actor),
                                  })}
                                </p>
                                {hasTech ? (
                                  <details className={styles.auditDetails}>
                                    <summary>{t("sign.auditLog.technicalDetails")}</summary>
                                    <div className={styles.auditTechList}>
                                      {event.documentHash ? (
                                        <div className={styles.auditTechRow}>
                                          <p className={styles.auditTechLabel}>
                                            {t("sign.auditLog.documentHash")}
                                          </p>
                                          <p className={styles.auditTechValue}>
                                            {event.documentHash}
                                          </p>
                                        </div>
                                      ) : null}
                                      {event.ipAddress ? (
                                        <div className={styles.auditTechRow}>
                                          <p className={styles.auditTechLabel}>
                                            {t("sign.auditLog.ipAddress")}
                                          </p>
                                          <p className={styles.auditTechValue}>
                                            {event.ipAddress}
                                          </p>
                                        </div>
                                      ) : null}
                                      {event.userAgent ? (
                                        <div className={styles.auditTechRow}>
                                          <p className={styles.auditTechLabel}>
                                            {t("sign.auditLog.userAgent")}
                                          </p>
                                          <p className={styles.auditTechValue}>
                                            {event.userAgent}
                                          </p>
                                        </div>
                                      ) : null}
                                    </div>
                                  </details>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </Card>
              ) : null}
              {!data.agreement.sign ||
              !(data.agreement.sign.hasSourcePdf || data.agreement.sign.hasFinalPdf) ? (
                <ConsultingAgreementDocument
                  view={{ ...data.agreement, locale }}
                  clientDisabled
                  employeeDisabled={Boolean(data.agreement.sign)}
                  showEmployeeCheckbox={!data.agreement.sign}
                  onEmployeeAccept={
                    busy || data.agreement.sign
                      ? undefined
                      : (accepted) => void acceptAgreement(accepted)
                  }
                />
              ) : null}
            </>
          ) : (
            <Card className={styles.panel}>
              <p className={styles.message}>{t("agreementEmpty")}</p>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className={styles.stack}>
          <Card className={styles.panel}>
            <h3 className={styles.sectionTitle}>{t("documents.client")}</h3>
            <ul className={styles.docList}>
              {data.clientDocuments.map((doc) => (
                <li key={doc.id}>
                  <div>
                    <a
                      className={styles.docNameLink}
                      href={`/api/client-cases/${caseId}/documents/${doc.id}?inline=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {doc.fileName}
                    </a>
                    <span>
                      {doc.category ?? "—"} · {doc.mimeType} ·{" "}
                      {formatDateTime(doc.createdAt, locale)}
                    </span>
                  </div>
                  <div className={styles.docActions}>
                    <a
                      className={styles.docActionBtn}
                      href={`/api/client-cases/${caseId}/documents/${doc.id}`}
                    >
                      <i className="fa-solid fa-download" aria-hidden />
                      {t("documents.download")}
                    </a>
                    <button
                      type="button"
                      className={styles.docDeleteBtn}
                      disabled={deletingDocId === doc.id}
                      onClick={() => void deleteDocument(doc)}
                    >
                      <i className="fa-solid fa-trash-can" aria-hidden />
                      {deletingDocId === doc.id ? "…" : t("documents.delete")}
                    </button>
                  </div>
                </li>
              ))}
              {data.clientDocuments.length === 0 ? <li>{t("documents.empty")}</li> : null}
            </ul>
          </Card>
          <Card className={styles.panel}>
            <h3 className={styles.sectionTitle}>{t("documents.employee")}</h3>
            <label className={styles.upload}>
              <input
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.heic,.zip"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadDocument(file);
                  e.target.value = "";
                }}
              />
              {t("documents.upload")}
            </label>
            <ul className={styles.docList}>
              {data.employeeDocuments.map((doc) => (
                <li key={doc.id}>
                  <div>
                    <a
                      className={styles.docNameLink}
                      href={`/api/client-cases/${caseId}/documents/${doc.id}?inline=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {doc.fileName}
                    </a>
                    <span>
                      {doc.category ?? "employee"} · {doc.uploadedByName ?? "—"} ·{" "}
                      {formatDateTime(doc.createdAt, locale)}
                    </span>
                  </div>
                  <div className={styles.docActions}>
                    <a
                      className={styles.docActionBtn}
                      href={`/api/client-cases/${caseId}/documents/${doc.id}`}
                    >
                      <i className="fa-solid fa-download" aria-hidden />
                      {t("documents.download")}
                    </a>
                    <button
                      type="button"
                      className={styles.docDeleteBtn}
                      disabled={deletingDocId === doc.id}
                      onClick={() => void deleteDocument(doc)}
                    >
                      <i className="fa-solid fa-trash-can" aria-hidden />
                      {deletingDocId === doc.id ? "…" : t("documents.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "comments" ? (
        <Card className={styles.panel}>
          <div className={styles.commentForm}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={t("comments.placeholder")}
            />
            <button type="button" disabled={busy} onClick={() => void submitComment()}>
              {t("comments.add")}
            </button>
          </div>
          <ul className={styles.commentList}>
            {data.comments.map((item) => (
              <li key={item.id}>
                <div className={styles.commentMeta}>
                  <strong>{item.authorName}</strong>
                  <span>{formatDateTime(item.createdAt, locale)}</span>
                </div>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "status" ? (
        <Card className={styles.panel}>
          <div className={styles.statusForm}>
            <span>{t("status.label")}</span>
            <FilterSelect
              className={styles.statusSelect}
              value={status}
              onChange={(value) => setStatus(value as ClientCaseStatus)}
              options={statusOptions}
              ariaLabel={t("status.label")}
            />
          </div>
          <button type="button" disabled={busy} onClick={() => void saveStatus()}>
            {t("status.save")}
          </button>
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card className={styles.panel}>
          <ul className={styles.historyList}>
            {data.activity.map((item) => (
              <li key={item.id} className={styles.historyItem}>
                <time className={styles.historyTime} dateTime={item.createdAt}>
                  {formatDateTime(item.createdAt, locale)}
                </time>
                <p className={styles.historyEvent}>
                  {caseActivityLabel(item.eventType, locale)}
                </p>
              </li>
            ))}
            {data.history.map((item) => (
              <li key={`status-${item.id}`} className={styles.historyItem}>
                <time className={styles.historyTime} dateTime={item.createdAt}>
                  {formatDateTime(item.createdAt, locale)}
                </time>
                <p className={styles.historyEvent}>
                  {caseStatusLabel(item.toStatus, locale)}
                  {item.note ? ` — ${item.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "finance" && canViewFinance ? (
        <ClientCaseFinanceTab caseId={caseId} />
      ) : null}
    </div>
  );
}
