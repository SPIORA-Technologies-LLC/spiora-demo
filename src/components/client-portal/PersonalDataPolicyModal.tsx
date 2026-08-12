"use client";

import { useEffect, useId, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import {
  CLIENT_PRIVACY_POLICY_PATH,
  personalDataPolicyPageTitle,
} from "@/lib/client-portal/personal-data-policy";
import { PersonalDataPolicyDocument } from "./PersonalDataPolicyDocument";
import styles from "./PersonalDataPolicyModal.module.css";

type PersonalDataPolicyModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PersonalDataPolicyModal({
  open,
  onClose,
}: PersonalDataPolicyModalProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("clientPortal.privacyPolicy");
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{t("eyebrow")}</p>
            <h2 id={titleId} className={styles.headerTitle}>
              {personalDataPolicyPageTitle(locale)}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <PersonalDataPolicyDocument locale={locale} />
        </div>

        <footer className={styles.footer}>
          <a
            className={styles.openPage}
            href={CLIENT_PRIVACY_POLICY_PATH}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("openFullPage")}
          </a>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            {t("done")}
          </button>
        </footer>
      </div>
    </div>
  );
}
