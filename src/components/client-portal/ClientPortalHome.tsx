"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import {
  caseStatusLabel,
} from "@/lib/client-portal/case-status-labels";
import type { ClientCasePublic, ClientCaseStatus } from "@/lib/client-portal/case-types";
import { nextCaseStatus } from "@/lib/client-portal/case-types";
import { ClientPortalEntrySplash } from "./ClientPortalEntrySplash";
import styles from "./ClientPortalShell.module.css";

const POLL_MS = 45_000;

type Props = {
  email: string;
  title: string;
  brand: string;
  questionnaireStatus: string;
  questionnaireProgress: string;
  questionnaireUnavailable?: boolean;
  questionnaireSubmitted?: boolean;
  questionnaireStarted?: boolean;
  initialCase: ClientCasePublic | null;
  logoutLabel: string;
  showEntrySplash?: boolean;
  showMfaSettings?: boolean;
  mfaReenrollRequired?: boolean;
  assistantSlot?: ReactNode;
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
  questionnaireStatus,
  questionnaireProgress,
  questionnaireUnavailable = false,
  questionnaireSubmitted = false,
  questionnaireStarted = false,
  initialCase,
  logoutLabel,
  showEntrySplash = false,
  showMfaSettings = false,
  mfaReenrollRequired = false,
  assistantSlot,
}: Props) {
  const t = useTranslations("clientPortal");
  const locale = useLocale() as "en" | "ru";
  const [caseData, setCaseData] = useState<ClientCasePublic | null>(initialCase);
  const [entrySplash, setEntrySplash] = useState(showEntrySplash);
  const inflightRef = useRef(false);
  const dismissSplash = useCallback(() => setEntrySplash(false), []);

  const refreshCase = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const res = await fetch("/api/client/case");
      if (res.status === 401) {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        if (body?.error?.code === "MFA_REQUIRED") {
          window.location.href = "/client/mfa/challenge?next=%2Fclient";
          return;
        }
        window.location.href = "/client/login";
        return;
      }
      if (res.status === 403) {
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
    <>
      {entrySplash ? <ClientPortalEntrySplash onDone={dismissSplash} /> : null}
      <div
        className={
          entrySplash
            ? `${styles.page} ${styles.pageUnderSplash}`
            : showEntrySplash
              ? `${styles.page} ${styles.pageAfterSplash}`
              : styles.page
        }
        lang={locale}
      >
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
          {showMfaSettings ? (
            <div className={styles.accountLinks}>
              <a className={styles.accountLink} href="/client/account/password">
                {t("home.changePassword")}
              </a>
              <a className={styles.accountLink} href="/client/account/mfa">
                {t("home.twoFactor")}
              </a>
            </div>
          ) : (
            <a className={styles.accountLink} href="/client/account/password">
              {t("home.changePassword")}
            </a>
          )}
          <button type="button" className={styles.logoutBtn} onClick={() => void onLogout()}>
            {logoutLabel}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {showMfaSettings && mfaReenrollRequired ? (
          <p className={styles.mfaBanner} role="status">
            {t("mfa.banner.reenroll")}{" "}
            <a href="/client/account/mfa">{t("mfa.banner.reenrollCta")}</a>
          </p>
        ) : null}
        <section className={styles.heroCard}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.hint}>{t("home.hint")}</p>
        </section>

        {caseData ? (
          <section className={styles.heroCard}>
            <h2 className={styles.processTitle}>{t("process.title")}</h2>
            <p className={styles.status}>
              <span className={styles.statusDot} aria-hidden />
              {caseStatusLabel(caseData.currentStatus, locale)}
            </p>
            {nextStep ? (
              <p className={styles.processNext}>
                {t("process.nextStep")}:{" "}
                <strong>{caseStatusLabel(nextStep, locale)}</strong>
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
            <p className={styles.tileEyebrow}>{t("nav.questionnaire")}</p>
            <h2>{questionnaireStatus}</h2>
            <p>{questionnaireProgress}</p>
            {!questionnaireUnavailable && !questionnaireSubmitted ? (
              <p className={styles.tileExplainer}>{t("home.questionnaireExplainer")}</p>
            ) : null}
            {questionnaireUnavailable ? null : questionnaireSubmitted ? (
              <a href="/client/questionnaire/submitted">{t("home.viewApplicationStatus")}</a>
            ) : (
              <a href="/client/questionnaire">
                {questionnaireStarted
                  ? t("home.continueQuestionnaire")
                  : t("home.fillQuestionnaire")}
              </a>
            )}
          </article>
        </section>

        {assistantSlot}
      </main>
    </div>
    </>
  );
}
