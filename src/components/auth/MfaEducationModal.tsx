"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { markEmployeeMfaOnboardingSeen } from "@/lib/auth/mfa-onboarding";
import styles from "./MfaEducationModal.module.css";

type View = "intro" | "details";

type Props = {
  userId: string;
  open: boolean;
  onClose: () => void;
  /** Primary CTA — start setup / open MFA settings */
  onSetupNow: () => void;
  initialView?: View;
};

/**
 * Reusable MFA education dialog (Phase C.2).
 * Audience-specific copy comes from `authMfa.onboarding` (employee).
 * Client portal can later reuse the same shell with a different namespace.
 */
export function MfaEducationModal({
  userId,
  open,
  onClose,
  onSetupNow,
  initialView = "intro",
}: Props) {
  const t = useTranslations("authMfa.onboarding");
  const titleId = useId();
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    if (open) setView(initialView);
  }, [open, initialView]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        markEmployeeMfaOnboardingSeen(userId);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, userId]);

  if (!open) return null;

  function dismiss() {
    markEmployeeMfaOnboardingSeen(userId);
    onClose();
  }

  function setupNow() {
    markEmployeeMfaOnboardingSeen(userId);
    onSetupNow();
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={dismiss}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {t("title")}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={t("close")}
            onClick={dismiss}
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          {view === "intro" ? (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t("whatTitle")}</h3>
                <p className={styles.p}>{t("whatP1")}</p>
                <p className={styles.p}>{t("whatP2")}</p>
                <p className={styles.p}>{t("whatP3")}</p>
              </section>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t("recommendTitle")}</h3>
                <p className={styles.p}>{t("recommendP1")}</p>
                <p className={styles.p}>{t("recommendP2")}</p>
                <ul className={styles.list}>
                  <li>{t("recommendBullet1")}</li>
                  <li>{t("recommendBullet2")}</li>
                  <li>{t("recommendBullet3")}</li>
                  <li>{t("recommendBullet4")}</li>
                </ul>
              </section>
            </>
          ) : (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t("howTitle")}</h3>
                <ol className={styles.steps}>
                  <li>
                    <strong>{t("step1Label")}</strong>
                    <span>{t("step1")}</span>
                  </li>
                  <li>
                    <strong>{t("step2Label")}</strong>
                    <span>{t("step2")}</span>
                  </li>
                  <li>
                    <strong>{t("step3Label")}</strong>
                    <span>{t("step3")}</span>
                    <ul className={styles.apps}>
                      <li>{t("appGoogle")}</li>
                      <li>{t("appMicrosoft")}</li>
                      <li>{t("app2fas")}</li>
                      <li>{t("appAuthy")}</li>
                    </ul>
                  </li>
                  <li>
                    <strong>{t("step4Label")}</strong>
                    <span>{t("step4")}</span>
                  </li>
                  <li>
                    <strong>{t("step5Label")}</strong>
                    <span>{t("step5")}</span>
                  </li>
                  <li>
                    <strong>{t("step6Label")}</strong>
                    <span>{t("step6")}</span>
                  </li>
                </ol>
                <p className={styles.p}>{t("done")}</p>
              </section>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t("lostTitle")}</h3>
                <p className={styles.p}>{t("lostP1")}</p>
                <p className={styles.p}>{t("lostP2")}</p>
                <p className={styles.p}>{t("lostP3")}</p>
              </section>
            </>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={setupNow}>
            {t("setupNow")}
          </button>
          <button type="button" className={styles.secondary} onClick={dismiss}>
            {t("later")}
          </button>
          {view === "intro" ? (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setView("details")}
            >
              {t("learnMore")}
            </button>
          ) : (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setView("intro")}
            >
              {t("backToSummary")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
