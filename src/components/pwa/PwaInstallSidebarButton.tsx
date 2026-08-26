"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { branding } from "@/config/branding";
import { usePwaInstallOffer } from "./usePwaInstallOffer";
import styles from "./PwaInstallSidebarButton.module.css";

export function PwaInstallSidebarButton() {
  const t = useTranslations("pwa");
  const { shouldOffer, platform, canPrompt, promptInstall } = usePwaInstallOffer();
  const [showHelp, setShowHelp] = useState(false);

  if (!shouldOffer) {
    return null;
  }

  const helpText =
    platform === "ios"
      ? t("installIos", { productName: branding.productName })
      : platform === "desktop"
        ? t("installDesktop", { productName: branding.productName })
        : canPrompt
          ? t("installHint", { productName: branding.productName })
          : t("installAndroidManual", { productName: branding.productName });

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          if (canPrompt) {
            void promptInstall();
            return;
          }
          setShowHelp((open) => !open);
        }}
      >
        <i className={`fa-solid fa-download ${styles.icon}`} aria-hidden />
        <span>{t("installNav")}</span>
      </button>
      {showHelp ? <p className={styles.help}>{helpText}</p> : null}
    </div>
  );
}
