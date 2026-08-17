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
import type { AppLocale } from "@/i18n/config";
import type { ClientCasePublic, ClientCaseStatus } from "@/lib/client-portal/case-types";
import { nextCaseStatus } from "@/lib/client-portal/case-types";
import { formatSignedAt } from "@/lib/client-portal/format-signed-at";
import type { ConsultingAgreementSignView } from "@/lib/client-portal/sign-types";
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
  showMfaSettings = false,
  mfaReenrollRequired = false,
  assistantSlot,
}: Props) {
  const t = useTranslations("clientPortal");
  const locale = useLocale() as AppLocale;
  const [caseData, setCaseData] = useState<ClientCasePublic | null>(initialCase);
  const [agreementSign, setAgreementSign] =
    useState<ConsultingAgreementSignView | null>(null);
  const inflightRef = useRef(false);
  const agreementInflightRef = useRef(false);

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

  const refreshAgreement = useCallback(async () => {
    if (questionnaireUnavailable || agreementInflightRef.current) return;
    agreementInflightRef.current = true;
    try {
      const res = await fetch("/api/client/agreement");
      if (!res.ok) return;
      const json = (await res.json()) as {
        agreement?: { sign?: ConsultingAgreementSignView | null };
      };
      setAgreementSign(json.agreement?.sign ?? null);
    } catch {
      // keep last known status
    } finally {
      agreementInflightRef.current = false;
    }
  }, [questionnaireUnavailable]);

  useEffect(() => {
    if (questionnaireUnavailable) return;
    void refreshAgreement();
    const id = window.setInterval(() => {
      void refreshAgreement();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [questionnaireUnavailable, refreshAgreement]);

  async function onLogout() {
    await fetch("/api/client/logout", { method: "POST" });
    window.location.href = "/client/login";
  }

  const currentStatus: ClientCaseStatus | null = caseData?.currentStatus ?? null;
  const nextStep = currentStatus ? nextCaseStatus(currentStatus) : null;

  const renderAccountActions = () => (
    <div className={styles.accountActions}>
      {showMfaSettings ? (
        <>
          <a className={styles.accountLink} href="/client/account/password">
            {t("home.changePassword")}
          </a>
          <a className={styles.accountLink} href="/client/account/mfa">
            {t("home.twoFactor")}
          </a>
        </>
      ) : (
        <a className={styles.accountLink} href="/client/account/password">
          {t("home.changePassword")}
        </a>
      )}
      <button type="button" className={styles.logoutBtn} onClick={() => void onLogout()}>
        {logoutLabel}
      </button>
    </div>
  );

  const mfaEducation =
    showMfaSettings ? (
      <section className={styles.heroCard} aria-labelledby="client-mfa-edu-title">
        <p className={styles.tileEyebrow}>{t("home.twoFactor")}</p>
        <h2 id="client-mfa-edu-title" className={styles.mfaEduTitle}>
          {t("mfa.onboarding.title")}
        </h2>
        <div className={styles.mfaEduBlock}>
          <h3 className={styles.mfaEduHeading}>{t("mfa.onboarding.whatTitle")}</h3>
          <p className={styles.mfaEduText}>{t("mfa.onboarding.whatP1")}</p>
          <p className={styles.mfaEduText}>{t("mfa.onboarding.whatP2")}</p>
          <p className={styles.mfaEduText}>{t("mfa.onboarding.whatP3")}</p>
        </div>
        <div className={styles.mfaEduBlock}>
          <h3 className={styles.mfaEduHeading}>
            {t("mfa.onboarding.recommendTitle")}
          </h3>
          <p className={styles.mfaEduText}>{t("mfa.onboarding.recommendP1")}</p>
          <p className={styles.mfaEduText}>{t("mfa.onboarding.recommendP2")}</p>
          <ul className={styles.mfaEduList}>
            <li>{t("mfa.onboarding.recommendBullet1")}</li>
            <li>{t("mfa.onboarding.recommendBullet2")}</li>
            <li>{t("mfa.onboarding.recommendBullet3")}</li>
          </ul>
        </div>
        <a className={styles.mfaEduCta} href="/client/account/mfa">
          {t("mfa.onboarding.setupCta")}
        </a>
      </section>
    ) : null;

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
          <div className={styles.headerAccountActions}>{renderAccountActions()}</div>
        </div>
      </header>

      <main className={styles.main}>
        {showMfaSettings && mfaReenrollRequired ? (
          <p className={`${styles.mfaBanner} ${styles.orderBanner}`} role="status">
            {t("mfa.banner.reenroll")}{" "}
            <a href="/client/account/mfa">{t("mfa.banner.reenrollCta")}</a>
          </p>
        ) : null}
        <section className={`${styles.heroCard} ${styles.orderWelcome}`}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.hint}>{t("home.hint")}</p>
        </section>

        <div className={styles.orderMfa}>{mfaEducation}</div>

        {caseData ? (
          <section className={`${styles.heroCard} ${styles.orderCase}`}>
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

        <section className={`${styles.grid} ${styles.orderQuestionnaire}`}>
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

        {questionnaireUnavailable ? null : (
          <section className={`${styles.grid} ${styles.orderQuestionnaire}`}>
            <article className={`${styles.placeholder} ${styles.agreementTile}`}>
              <p className={styles.tileEyebrow}>{t("consultingAgreement.homeEyebrow")}</p>
              <h2>{t("consultingAgreement.homeTitle")}</h2>
              {agreementSign && agreementSign.status !== "draft" ? (
                <div className={styles.agreementMeta}>
                  <p className={styles.tileStatus}>
                    {t(`consultingAgreement.sign.status.${agreementSign.status}`)}
                  </p>
                  {agreementSign.clientSignedAt ? (
                    <p>
                      {t("consultingAgreement.sign.clientSignedAt")}:{" "}
                      {formatSignedAt(agreementSign.clientSignedAt, locale)}
                    </p>
                  ) : null}
                  {agreementSign.providerSignedAt ? (
                    <p>
                      {t("consultingAgreement.sign.providerSignedAt")}:{" "}
                      {formatSignedAt(agreementSign.providerSignedAt, locale)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p>
                  {questionnaireSubmitted
                    ? t("consultingAgreement.homeHint")
                    : t("consultingAgreement.homeHintDraft")}
                </p>
              )}
              <a
                href={
                  questionnaireSubmitted
                    ? "/client/agreement"
                    : "/client/questionnaire/consulting_agreement"
                }
              >
                {t("consultingAgreement.open")}
              </a>
            </article>
          </section>
        )}

        {assistantSlot ? (
          <div className={styles.orderAssistant}>{assistantSlot}</div>
        ) : null}

        <div className={styles.mobileAccountActions}>{renderAccountActions()}</div>
      </main>

      <footer className={styles.legalFooter}>
        <a href="/client/privacy">{t("privacyPolicy.footerLink")}</a>
      </footer>
    </div>
  );
}
