"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./MfaReenrollBanner.module.css";

export function MfaReenrollBanner() {
  const t = useTranslations("authMfa");

  return (
    <div className={styles.banner} role="status">
      <p className={styles.message}>{t("banner.reenroll")}</p>
      <Link href="/settings/mfa" className={styles.cta}>
        {t("banner.reenrollCta")}
      </Link>
    </div>
  );
}
