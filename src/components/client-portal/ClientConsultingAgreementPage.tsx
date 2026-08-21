"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
      <main className={privacyStyles.mainAgreement}>
        {error ? <p>{error}</p> : null}
        {!error && !view ? <p>{t("loading")}</p> : null}
        {view ? (
          <ConsultingAgreementDocument
            view={view}
            showClientSign
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
