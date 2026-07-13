"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ASK_SPIORA_CHIPS } from "@/lib/dashboard/first-impression-seed";
import styles from "./FirstImpressionView.module.css";

export function AskSpioraPanel() {
  const t = useTranslations("commandCenter");

  return (
    <section className={`${styles.panel} ${styles.askPanel} ${styles.fadeInUp}`} style={{ animationDelay: "320ms" }}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{t("askSpiora.title")}</h2>
        <p className={styles.panelLead}>{t("askSpiora.lead")}</p>
      </div>
      <div className={styles.chipGrid}>
        {ASK_SPIORA_CHIPS.map((chip) => (
          <Link key={chip.id} href={chip.href} className={styles.chip}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden />
            <span>{t(chip.labelKey)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
