"use client";

import { useTranslations } from "next-intl";
import { listTeamUsers } from "@/lib/auth/users";
import styles from "./DemoCredentials.module.css";

export function DemoCredentials() {
  const t = useTranslations("auth");
  const accounts = listTeamUsers();

  return (
    <aside className={styles.box} aria-label={t("demoEnvironment")}>
      <p className={styles.title}>{t("demoAccountsTitle")}</p>
      <ul className={styles.list}>
        {accounts.map((account) => (
          <li key={account.email} className={styles.item}>
            <span className={styles.role}>
              {account.name} ({account.role})
            </span>
            <code className={styles.code}>{account.email}</code>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>{t("demoPasswordHint")}</p>
    </aside>
  );
}
