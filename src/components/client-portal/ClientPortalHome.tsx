"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import {
  caseStatusLabel,
} from "@/lib/client-portal/case-status-labels";
import type { ClientCasePublic, ClientCaseStatus } from "@/lib/client-portal/case-types";
import { nextCaseStatus } from "@/lib/client-portal/case-types";
import styles from "./ClientPortalShell.module.css";

const POLL_MS = 45_000;

type Props = {
  email: string;
  title: string;
  brand: string;
  statusLabel: string;
  questionnaireStatus: string;
  questionnaireProgress: string;
  questionnaireUnavailable?: boolean;
  questionnaireSubmitted?: boolean;
  initialCase: ClientCasePublic | null;
  placeholders: {
    questionnaire: string;
    documents: string;
    status: string;
  };
  logoutLabel: string;
};

function formatHistoryDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function ClientPortalHome({
  email,
  title,
  brand,
  statusLabel,
  questionnaireStatus,
  questionnaireProgress,
  questionnaireUnavailable = false,
  questionnaireSubmitted = false,
  initialCase,
  placeholders,
  logoutLabel,
}: Props) {
  const t = useTranslations("clientPortal");
  const locale = useLocale() as "en" | "ru";
  const [caseData, setCaseData] = useState<ClientCasePublic | null>(initialCase);
  const inflightRef = useRef(false);

  const refreshCase = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const res = await fetch("/api/client/case");
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/client/login";
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as { case: ClientCasePublic | null };
      setCaseData(json.case);
    } catch {
      // network error — keep last known status
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!questionnaireSubmitted && !initialCase) return;
    const id = window.setInterval(() => {
      void refreshCase();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [questionnaireSubmitted, initialCase, refreshCase]);

  async function onLogout() {
    await fetch("/api/client/logout", { method: "POST" });
    window.location.href = "/client/login";
  }

  const currentStatus: ClientCaseStatus | null = caseData?.currentStatus ?? null;
  const nextStep = currentStatus ? nextCaseStatus(currentStatus) : null;

  return (
    <div className={styles.page} lang={locale}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <Logo size="sm" />
          <div>
            <p className={styles.brand}>{brand}</p>
            <p className={styles.email}>{email}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <button type="button" className={styles.logoutBtn} onClick={() => void onLogout()}>
            {logoutLabel}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroCard}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.status}>
            {currentStatus
              ? `${t("home.applicationStatus")}: ${caseStatusLabel(currentStatus, locale)}`
              : statusLabel}
          </p>
          <p className={styles.hint}>{t("home.hint")}</p>
        </section>

        {caseData ? (
          <section className={styles.heroCard}>
            <h2 className={styles.processTitle}>{t("process.title")}</h2>
            <p className={styles.status}>
              ✔ {caseStatusLabel(caseData.currentStatus, locale)}
            </p>
            {nextStep ? (
              <p className={styles.hint}>
                {t("process.nextStep")}: {caseStatusLabel(nextStep, locale)}
              </p>
            ) : null}
            {caseData.history.length > 0 ? (
              <>
                <h3 className={styles.processHistoryTitle}>{t("process.history")}</h3>
                <ul className={styles.processHistory}>
                  {[...caseData.history]
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .map((item) => (
                      <li key={item.id}>
                        <span>{formatHistoryDate(item.createdAt, locale)}</span>
                        <span>
                          {caseStatusLabel(
                            item.toStatus,
                            locale,
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

        <section className={styles.grid}>
          <article className={styles.placeholder}>
            <h2>{t("nav.questionnaire")}</h2>
            <p>{questionnaireStatus}</p>
            <p>{questionnaireProgress}</p>
            {questionnaireUnavailable ? null : questionnaireSubmitted ? (
              <a href="/client/questionnaire/submitted">{t("home.viewApplicationStatus")}</a>
            ) : (
              <a href="/client/questionnaire">{t("home.continueQuestionnaire")}</a>
            )}
          </article>
          <article className={styles.placeholder}>
            <h2>{t("nav.documents")}</h2>
            <p>{placeholders.documents}</p>
          </article>
          <article className={styles.placeholder}>
            <h2>{t("nav.status")}</h2>
            <p>
              {currentStatus
                ? caseStatusLabel(currentStatus, locale)
                : placeholders.status}
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
