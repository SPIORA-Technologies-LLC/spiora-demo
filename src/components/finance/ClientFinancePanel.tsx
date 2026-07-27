"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { AppLocale } from "@/i18n/config";
import type { FinanceClientDetail } from "@/lib/finance/types";
import { formatEuroFromCents } from "@/lib/finance/money";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import styles from "./ClientFinancePanel.module.css";

type Props = { clientId: string };

type ModalKind =
  | { type: "changeAmount" }
  | { type: "changeDate" }
  | { type: "addPayment" }
  | { type: "void"; paymentId: string };

export function ClientFinancePanel({ clientId }: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.client");
  const tStatus = useTranslations("finance.status");

  const [data, setData] = useState<FinanceClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalKind | null>(null);

  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");

  const [modalAmount, setModalAmount] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [modalComment, setModalComment] = useState("");
  const [modalReason, setModalReason] = useState("");

  const basePath = `/api/clients/${encodeURIComponent(clientId)}/finance`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(basePath);
      const json = (await res.json()) as {
        finance?: FinanceClientDetail;
        error?: string;
      };
      if (!res.ok || !json.finance) {
        setData(null);
        setError(json.error ?? t("noData"));
        return;
      }
      setData(json.finance);
    } catch {
      setData(null);
      setError(t("noData"));
    } finally {
      setLoading(false);
    }
  }, [basePath, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fmt = useCallback(
    (cents: number | null | undefined) => formatEuroFromCents(cents, locale),
    [locale],
  );

  const resetModal = () => {
    setModal(null);
    setModalAmount("");
    setModalDate("");
    setModalComment("");
    setModalReason("");
  };

  const handleCreateContract = async () => {
    if (!newAmount.trim() || !newDate.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: newAmount, contractDate: newDate }),
      });
      const json = (await res.json()) as {
        finance?: FinanceClientDetail;
        error?: string;
      };
      if (!res.ok || !json.finance) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      setData(json.finance);
      setNewAmount("");
      setNewDate("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContractChange = async () => {
    if (!modal || !data?.profile || !modalReason.trim()) return;
    const body: Record<string, unknown> = {
      expectedVersion: data.profile.version,
      reason: modalReason.trim(),
    };
    if (modal.type === "changeAmount") {
      if (!modalAmount.trim()) return;
      body.amount = modalAmount;
    } else if (modal.type === "changeDate") {
      if (!modalDate.trim()) return;
      body.contractDate = modalDate;
    } else {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/contract/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        finance?: FinanceClientDetail;
        error?: string;
      };
      if (!res.ok || !json.finance) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      setData(json.finance);
      resetModal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!modalAmount.trim() || !modalDate.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          amount: modalAmount,
          paymentDate: modalDate,
          comment: modalComment.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        finance?: FinanceClientDetail;
        error?: string;
      };
      if (!res.ok || !json.finance) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      setData(json.finance);
      resetModal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!modal || modal.type !== "void" || !modalReason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/payments/${modal.paymentId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: modalReason.trim() }),
      });
      const json = (await res.json()) as {
        finance?: FinanceClientDetail;
        error?: string;
      };
      if (!res.ok || !json.finance) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      setData(json.finance);
      resetModal();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className={styles.loading} aria-busy="true">{t("loading")}</p>;
  }

  if (!data) {
    return <p className={styles.loading}>{error ?? t("noData")}</p>;
  }

  const { profile, summary, payments, direction } = data;
  const hasContract = profile != null && profile.contractAmountCents != null;
  const activePayments = payments.filter((p) => !p.voidedAt);
  const voidedPayments = payments.filter((p) => p.voidedAt);

  return (
    <div className={styles.wrap}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Card className={styles.panel}>
        <h2 className={styles.panelTitle}>{t("contractTitle")}</h2>
        <p className={styles.statusLine}>
          {tStatus(summary.paymentStatus)}
        </p>

        {hasContract && profile ? (
          <>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("contractAmount")}</span>
                <span className={styles.fieldValue}>
                  {fmt(profile.contractAmountCents)}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("contractDate")}</span>
                <span className={styles.fieldValue}>
                  {profile.contractDate ?? "—"}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("direction")}</span>
                <span className={styles.fieldValue}>{direction || "—"}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("paid")}</span>
                <span className={styles.fieldValue}>
                  {fmt(summary.paidAmountCents)}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t("balance")}</span>
                <span className={styles.fieldValue}>
                  {fmt(summary.balanceCents)}
                </span>
              </div>
            </div>
            {summary.overpaymentCents > 0 ? (
              <p className={styles.overpayment}>
                {t("overpayment", { amount: fmt(summary.overpaymentCents) })}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal({ type: "changeAmount" })}
              >
                {t("changeAmount")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal({ type: "changeDate" })}
              >
                {t("changeDate")}
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.createForm}>
            <label className={styles.field}>
              <span>{t("contractAmount")}</span>
              <input
                className={styles.input}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="3800"
                disabled={submitting}
              />
            </label>
            <label className={styles.field}>
              <span>{t("contractDate")}</span>
              <input
                className={styles.input}
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                disabled={submitting}
              />
            </label>
            <p className={styles.hint}>
              {t("direction")}: {direction || "—"}
            </p>
            <Button
              type="button"
              onClick={() => void handleCreateContract()}
              disabled={submitting || !newAmount.trim() || !newDate.trim()}
            >
              {submitting ? t("saving") : t("createContract")}
            </Button>
          </div>
        )}
      </Card>

      <Card className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>{t("paymentsTitle")}</h2>
          {hasContract ? (
            <Button
              type="button"
              onClick={() => setModal({ type: "addPayment" })}
              disabled={submitting}
            >
              {t("addPayment")}
            </Button>
          ) : null}
        </div>

        {activePayments.length === 0 ? (
          <p className={styles.emptyPayments}>{t("noPayments")}</p>
        ) : (
          <ul className={styles.paymentList}>
            {activePayments.map((p) => (
              <li key={p.id} className={styles.paymentItem}>
                <div>
                  <strong>{fmt(p.amountCents)}</strong>
                  <span className={styles.paymentMeta}>
                    {" · "}
                    {p.paymentDate}
                    {p.comment ? ` · ${p.comment}` : ""}
                    {" · "}
                    {p.createdByName}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setModal({ type: "void", paymentId: p.id })}
                >
                  {t("void")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {voidedPayments.length > 0 ? (
          <>
            <h3 className={styles.subTitle}>{t("voidedPayments")}</h3>
            <ul className={styles.paymentList}>
              {voidedPayments.map((p) => (
                <li key={p.id} className={styles.paymentItemVoided}>
                  <span>
                    {fmt(p.amountCents)} · {p.paymentDate}
                    {p.voidReason
                      ? ` · ${t("voidReason")}: ${p.voidReason}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      {modal ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.backdrop} onClick={() => !submitting && resetModal()} />
          <Card className={styles.modal}>
            <h2 className={styles.modalTitle}>
              {modal.type === "changeAmount" && t("changeAmountTitle")}
              {modal.type === "changeDate" && t("changeDateTitle")}
              {modal.type === "addPayment" && t("addPaymentTitle")}
              {modal.type === "void" && t("voidPaymentTitle")}
            </h2>

            {modal.type === "changeAmount" ? (
              <label className={styles.field}>
                <span>{t("amount")}</span>
                <input
                  className={styles.input}
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  disabled={submitting}
                />
              </label>
            ) : null}

            {modal.type === "changeDate" ? (
              <label className={styles.field}>
                <span>{t("newDate")}</span>
                <input
                  className={styles.input}
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  disabled={submitting}
                />
              </label>
            ) : null}

            {modal.type === "addPayment" ? (
              <>
                <label className={styles.field}>
                  <span>{t("amount")}</span>
                  <input
                    className={styles.input}
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    disabled={submitting}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t("paymentDate")}</span>
                  <input
                    className={styles.input}
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    disabled={submitting}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t("comment")}</span>
                  <input
                    className={styles.input}
                    value={modalComment}
                    onChange={(e) => setModalComment(e.target.value)}
                    disabled={submitting}
                  />
                </label>
              </>
            ) : null}

            {modal.type === "changeAmount" ||
            modal.type === "changeDate" ||
            modal.type === "void" ? (
              <label className={styles.field}>
                <span>{t("reason")}</span>
                <textarea
                  className={styles.textarea}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  disabled={submitting}
                  rows={3}
                />
              </label>
            ) : null}

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={resetModal}
                disabled={submitting}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant={modal.type === "void" ? "danger" : "primary"}
                disabled={submitting}
                onClick={() => {
                  if (modal.type === "addPayment") void handleAddPayment();
                  else if (modal.type === "void") void handleVoid();
                  else void handleContractChange();
                }}
              >
                {submitting ? t("saving") : t("confirm")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
