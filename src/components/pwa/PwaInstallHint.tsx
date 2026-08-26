"use client";

import { branding } from "@/config/branding";
import { useTranslations } from "next-intl";
import { usePwaInstallOffer } from "./usePwaInstallOffer";
import styles from "./PwaInstallHint.module.css";

export function PwaInstallHint() {
  const t = useTranslations("pwa");
  const { shouldOffer, platform, canPrompt, promptInstall, dismiss } =
    usePwaInstallOffer();

  if (!shouldOffer) {
    return null;
  }

  const hint =
    platform === "ios"
      ? t("installIos", { productName: branding.productName })
      : platform === "desktop"
        ? t("installDesktop", { productName: branding.productName })
        : platform === "android" && !canPrompt
          ? t("installAndroidManual", { productName: branding.productName })
          : t("installHint", { productName: branding.productName });

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>{hint}</p>
      {canPrompt ? (
        <p className={styles.note}>{t("browserDialogNote")}</p>
      ) : null}
      <div className={styles.actions}>
        {canPrompt ? (
          <button
            type="button"
            className={styles.installBtn}
            onClick={() => {
              void promptInstall();
            }}
          >
            {t("install")}
          </button>
        ) : null}
        <button type="button" className={styles.dismissBtn} onClick={dismiss}>
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
