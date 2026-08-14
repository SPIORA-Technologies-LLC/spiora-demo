"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { ConsultingAgreementDocument } from "./ConsultingAgreementDocument";
import type { ConsultingAgreementView } from "@/lib/client-portal/consulting-agreement-fields";
import privacyStyles from "@/app/client/privacy/privacy.module.css";

export function ClientConsultingAgreementPage() {
  const t = useTranslations("clientPortal.consultingAgreement");
  const locale = useLocale() as "en" | "ru";
  const [view, setView] = useState<ConsultingAgreementView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/client/agreement");
        if (!res.ok) throw new Error("failed");
        const json = (await res.json()) as { agreement: ConsultingAgreementView };
        if (!cancelled) {
          setView({ ...json.agreement, locale });
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t("loadFailed"));
      }
    }

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [locale, t]);

  return (
    <div className={privacyStyles.page}>
      <header className={privacyStyles.header}>
        <a className={privacyStyles.brand} href="/client">
          <Logo size="sm" />
          <span>SPIORA</span>
        </a>
        <div className={privacyStyles.headerActions}>
          <LanguageSwitcher compact />
          <a className={privacyStyles.backLink} href="/client">
            {t("backToPortal")}
          </a>
        </div>
      </header>
      <main className={privacyStyles.main}>
        {error ? <p>{error}</p> : null}
        {!error && !view ? <p>{t("loading")}</p> : null}
        {view ? (
          <ConsultingAgreementDocument
            view={{ ...view, locale }}
            clientDisabled
            employeeDisabled
            showEmployeeCheckbox
          />
        ) : null}
      </main>
    </div>
  );
}
