"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import {
  caseStatusLabel,
} from "@/lib/client-portal/case-status-labels";
import type { ClientCasePublic, ClientCaseStatus } from "@/lib/client-portal/case-types";
import styles from "./ClientPortalShell.module.css";

type Props = {
  email: string;
  submittedAt: string | null;
  initialStatus: ClientCaseStatus | null;
};

function formatDate(iso: string | null, locale: string) {
  if (!iso) return "—";
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

export function ClientQuestionnaireSubmittedPage({
  email,
  submittedAt,
  initialStatus,
}: Props) {
  const t = useTranslations("clientPortal");
  const locale = useLocale() as "en" | "ru";
  const [caseData, setCaseData] = useState<ClientCasePublic | null>(
    initialStatus
      ? {
          id: "",
          currentStatus: initialStatus,
          submittedAt: submittedAt ?? new Date().toISOString(),
          serviceType: null,
          nextStep: null,
          history: [],
        }
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/client/case");
      if (!res.ok || cancelled) return;
      const json = (await res.json()) as { case: ClientCasePublic | null };
      if (!cancelled && json.case) setCaseData(json.case);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = caseData?.currentStatus ?? initialStatus ?? "application_received";
  const when = caseData?.submittedAt ?? submittedAt;

  async function onLogout() {
    await fetch("/api/client/logout", { method: "POST" });
    window.location.href = "/client/login";
  }

  return (
    <div className={styles.page} lang={locale}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <Logo size="sm" />
          <div>
            <p className={styles.brand}>{t("brand")}</p>
            <p className={styles.email}>{email}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <button type="button" className={styles.logoutBtn} onClick={() => void onLogout()}>
            {t("logout")}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroCard}>
          <h1 className={styles.title}>{t("thankYou.title")}</h1>
          <p className={styles.hint}>{t("thankYou.body")}</p>
          <p className={styles.status}>
            {t("thankYou.currentStatus")}: {caseStatusLabel(status, locale)}
          </p>
          <p className={styles.hint}>
            {t("thankYou.submittedAt")}: {formatDate(when, locale)}
          </p>
          <p className={styles.hint}>{t("thankYou.next")}</p>
          <p>
            <a href="/client">{t("thankYou.backHome")}</a>
          </p>
        </section>
      </main>
    </div>
  );
}
