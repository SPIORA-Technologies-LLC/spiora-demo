"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import styles from "./CalendarEmptyState.module.css";

type CalendarEmptyStateProps = {
  onCreate?: () => void;
  createDisabled?: boolean;
};

export function CalendarEmptyState({
  onCreate,
  createDisabled = true,
}: CalendarEmptyStateProps) {
  const t = useTranslations("calendar.empty");
  const tToolbar = useTranslations("calendar.toolbar");

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          📅
        </div>
        <h3 className={styles.title}>{t("title")}</h3>
        <p className={styles.text}>{t("text")}</p>
        <Button
          type="button"
          disabled={createDisabled}
          title={
            createDisabled ? tToolbar("createDisabledTitle") : undefined
          }
          onClick={onCreate}
        >
          {t("createEvent")}
        </Button>
      </div>
    </div>
  );
}
