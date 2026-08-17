import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { PersonalDataPolicyDocument } from "@/components/client-portal/PersonalDataPolicyDocument";
import { personalDataPolicyPageTitle } from "@/lib/client-portal/personal-data-policy";
import styles from "./privacy.module.css";

export async function generateMetadata() {
  const locale = (await getLocale()) as AppLocale;
  return {
    title: personalDataPolicyPageTitle(locale),
  };
}

export default async function ClientPrivacyPolicyPage() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("clientPortal.privacyPolicy");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/client">
          <Logo size="sm" />
        </a>
        <div className={styles.headerActions}>
          <LanguageSwitcher compact />
          <a className={styles.backLink} href="/client">
            {t("backToPortal")}
          </a>
        </div>
      </header>

      <main className={styles.main}>
        <PersonalDataPolicyDocument locale={locale} className={styles.document} />
      </main>
    </div>
  );
}
