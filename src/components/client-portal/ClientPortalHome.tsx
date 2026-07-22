"use client";

import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import styles from "./ClientPortalShell.module.css";

type Props = {
  email: string;
  title: string;
  brand: string;
  statusLabel: string;
  questionnaireStatus: string;
  questionnaireProgress: string;
  questionnaireUnavailable?: boolean;
  placeholders: {
    questionnaire: string;
    documents: string;
    status: string;
  };
  logoutLabel: string;
};

export function ClientPortalHome({
  email,
  title,
  brand,
  statusLabel,
  questionnaireStatus,
  questionnaireProgress,
  questionnaireUnavailable = false,
  placeholders,
  logoutLabel,
}: Props) {
  const t = useTranslations("clientPortal");
  const locale = useLocale();

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
          <p className={styles.status}>{statusLabel}</p>
          <p className={styles.hint}>{t("home.hint")}</p>
        </section>

        <section className={styles.grid}>
          <article className={styles.placeholder}>
            <h2>{t("nav.questionnaire")}</h2>
            <p>{questionnaireStatus}</p>
            <p>{questionnaireProgress}</p>
            {questionnaireUnavailable ? null : (
              <a href="/client/questionnaire">{t("home.continueQuestionnaire")}</a>
            )}
          </article>
          <article className={styles.placeholder}>
            <h2>{t("nav.documents")}</h2>
            <p>{placeholders.documents}</p>
          </article>
          <article className={styles.placeholder}>
            <h2>{t("nav.status")}</h2>
            <p>{placeholders.status}</p>
          </article>
        </section>
      </main>
    </div>
  );
}
