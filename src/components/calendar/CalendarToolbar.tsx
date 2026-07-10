"use client";

import { useTranslations } from "next-intl";
import styles from "./CalendarToolbar.module.css";

export type CalendarToolbarProps = {
  label: string;
  timeZoneLabel?: string;
  view: "day" | "week" | "month";
  createDisabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: "day" | "week" | "month") => void;
  onCreate?: () => void;
};

export function CalendarToolbar({
  label,
  timeZoneLabel,
  view,
  createDisabled = true,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onCreate,
}: CalendarToolbarProps) {
  const t = useTranslations("calendar.toolbar");

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarMain}>
        <div className={styles.navGroup}>
        <button type="button" className={styles.navButton} onClick={onPrev} aria-label={t("prevAria")}>
          ◀
        </button>
        <h2 className={styles.periodLabel}>{label}</h2>
        <button type="button" className={styles.navButton} onClick={onNext} aria-label={t("nextAria")}>
          ▶
        </button>
        <button type="button" className={styles.todayButton} onClick={onToday}>
          {t("today")}
        </button>
      </div>

      <div className={styles.actions}>
        <div className={styles.viewSwitch} role="tablist" aria-label={t("viewModeAria")}>
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              className={[styles.viewButton, view === mode ? styles.viewButtonActive : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onViewChange(mode)}
            >
              {t(`views.${mode}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.createButton}
          disabled={createDisabled}
          title={createDisabled ? t("createDisabledTitle") : undefined}
          onClick={onCreate}
        >
          {t("createEvent")}
        </button>
      </div>
      </div>

      {timeZoneLabel ? (
        <p className={styles.timeZoneLabel}>{t("yourTime", { label: timeZoneLabel })}</p>
      ) : null}
    </div>
  );
}
