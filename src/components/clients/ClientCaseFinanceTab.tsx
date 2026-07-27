"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ClientFinancePanel } from "@/components/finance/ClientFinancePanel";
import styles from "./ClientCaseDetail.module.css";

type Props = { caseId: string };

/**
 * Lazy CRM link (variant A): first Finance open ensures CRM client, then
 * reuses the standard ClientFinancePanel by external_id.
 */
export function ClientCaseFinanceTab({ caseId }: Props) {
  const t = useTranslations("clientIntake.detail.finance");
  const [externalId, setExternalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensure() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/client-cases/${encodeURIComponent(caseId)}/ensure-crm-client`,
          { method: "POST" },
        );
        const json = (await res.json()) as {
          externalId?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.externalId) {
          setExternalId(null);
          setError(json.error ?? t("linkFailed"));
          return;
        }
        setExternalId(json.externalId);
      } catch {
        if (!cancelled) {
          setExternalId(null);
          setError(t("linkFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void ensure();
    return () => {
      cancelled = true;
    };
  }, [caseId, t]);

  if (loading) {
    return <p className={styles.financeStatus}>{t("linking")}</p>;
  }

  if (error || !externalId) {
    return <p className={styles.financeStatus}>{error ?? t("linkFailed")}</p>;
  }

  return (
    <div className={styles.financeWrap}>
      <p className={styles.financeHint}>{t("linkedHint")}</p>
      <ClientFinancePanel clientId={externalId} />
    </div>
  );
}
