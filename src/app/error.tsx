"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";
import styles from "./error-pages.module.css";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.serverError");

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo href="/dashboard" size="sidebar" className={styles.logo} />
        <p className={styles.code}>500</p>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.description}>{t("description")}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => reset()}>
            {t("retry")}
          </button>
          <Link href="/dashboard" className={styles.linkButton}>
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
