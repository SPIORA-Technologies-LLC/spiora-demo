import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import styles from "./error-pages.module.css";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo href="/dashboard" size="sidebar" className={styles.logo} />
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.description}>{t("description")}</p>
        <Link href="/dashboard" className={styles.button}>
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
