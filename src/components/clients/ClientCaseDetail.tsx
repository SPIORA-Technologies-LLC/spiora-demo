"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ClientCaseFinanceTab } from "@/components/clients/ClientCaseFinanceTab";
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
};

type TabId =
  | "overview"
  | "questionnaire"
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
  const [data, setData] = useState<CaseDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<ClientCaseStatus>("application_received");
  const [busy, setBusy] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/client-cases/${caseId}`);
    if (!res.ok) {
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as CaseDetailPayload;
    setData(json);
    setStatus(json.case.currentStatus);
    setLoading(false);
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

  if (loading) return <p>{t("loading")}</p>;
  if (!data) return <p>{t("notFound")}</p>;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: t("tabs.overview") },
    { id: "questionnaire", label: t("tabs.questionnaire") },
    { id: "documents", label: t("tabs.documents") },
    { id: "comments", label: t("tabs.comments") },
    { id: "status", label: t("tabs.status") },
    { id: "history", label: t("tabs.history") },
    ...(canViewFinance
      ? ([{ id: "finance" as const, label: t("tabs.finance") }] as const)
      : []),
  ];

  return (
    <div className={styles.page}>
      <Link href="/clients/intake" className={styles.back}>
        ← {t("back")}
      </Link>

      <div className={styles.tabs}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
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
          <label className={styles.statusForm}>
            <span>{t("status.label")}</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientCaseStatus)}
            >
              {CLIENT_CASE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {caseStatusLabel(value, locale)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void saveStatus()}>
            {t("status.save")}
          </button>
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card className={styles.panel}>
          <ul className={styles.historyList}>
            {data.activity.map((item) => (
              <li key={item.id}>
                <span>{formatDateTime(item.createdAt, locale)}</span>
                <span>{caseActivityLabel(item.eventType, locale)}</span>
              </li>
            ))}
            {data.history.map((item) => (
              <li key={`status-${item.id}`}>
                <span>{formatDateTime(item.createdAt, locale)}</span>
                <span>
                  {caseStatusLabel(item.toStatus, locale)}
                  {item.note ? ` — ${item.note}` : ""}
                </span>
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
