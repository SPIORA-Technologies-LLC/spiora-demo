"use client";

import { useTranslations } from "next-intl";
import { signOutAction } from "@/app/login/actions";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import styles from "./Topbar.module.css";

export type TopbarClientProps = {
  sectionTitle: string;
  userName?: string;
  userRole?: string;
  searchPlaceholder?: string;
  defaultSearchValue?: string;
  onSearchChange?: (value: string) => void;
  onToggleNav?: () => void;
  navOpen?: boolean;
};

export function TopbarClient({
  sectionTitle,
  userName,
  userRole,
  searchPlaceholder,
  defaultSearchValue,
  onSearchChange,
  onToggleNav,
  navOpen = false,
}: TopbarClientProps) {
  const t = useTranslations();

  return (
    <header className={styles.topbar}>
      <div className={styles.leading}>
        <button
          type="button"
          className={[
            styles.navToggle,
            navOpen ? styles.navToggleHidden : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={t("shell.mainNavAria")}
          aria-hidden={navOpen}
          tabIndex={navOpen ? -1 : 0}
          onClick={onToggleNav}
        >
          <i className="fa-solid fa-bars" aria-hidden />
        </button>
        <h2 className={styles.sectionTitle}>{sectionTitle}</h2>
      </div>

      <div className={styles.searchWrap}>
        <i
          className={`fa-solid fa-magnifying-glass ${styles.searchIcon}`}
          aria-hidden
        />
        <input
          type="search"
          className={styles.search}
          placeholder={searchPlaceholder ?? t("shell.search")}
          defaultValue={defaultSearchValue}
          onChange={
            onSearchChange
              ? (e) => onSearchChange(e.target.value)
              : undefined
          }
          aria-label={t("shell.searchAria")}
        />
      </div>

      <div className={styles.user}>
        <LanguageSwitcher />
        <NotificationBell />
        <div className={styles.avatar} aria-hidden>
          <i className="fa-solid fa-user" />
        </div>
        <div className={styles.userMeta}>
          <span className={styles.userName}>
            {userName ?? t("shell.userFallback")}
          </span>
          <span className={styles.userRole}>
            {userRole ?? t("shell.teamFallback")}
          </span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className={styles.logout}
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden />
            <span className={styles.logoutLabel}>{t("nav.logout")}</span>
          </button>
        </form>
      </div>
    </header>
  );
}
