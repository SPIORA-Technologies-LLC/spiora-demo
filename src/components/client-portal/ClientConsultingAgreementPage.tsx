"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { ConsultingAgreementDocument } from "./ConsultingAgreementDocument";
import type { ConsultingAgreementView } from "@/lib/client-portal/consulting-agreement-fields";
import privacyStyles from "@/app/client/privacy/privacy.module.css";

export function ClientConsultingAgreementPage() {
  const t = useTranslations("clientPortal.consultingAgreement");
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
          setView(json.agreement);
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
  }, [t]);

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
            view={view}
            clientDisabled
            employeeDisabled
            showEmployeeCheckbox
            showClientSign={Boolean(view.sign?.canClientSign)}
            preferPdfAfterPublish
            onClientSigned={(sign) =>
              setView((prev) => (prev ? { ...prev, sign } : prev))
            }
          />
        ) : null}
      </main>
    </div>
  );
}
