"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { shiftActivityDayKey } from "@/lib/presence/daily-activity-logic";
import styles from "./FirstImpressionView.module.css";

type CommandCenterDatePickerProps = {
  dayKey: string;
  todayKey: string;
  minDayKey: string;
  maxDayKey: string;
  loading?: boolean;
  onSelectDay: (dayKey: string) => void;
};

export function CommandCenterDatePicker({
  dayKey,
  todayKey,
  minDayKey,
  maxDayKey,
  loading = false,
  onSelectDay,
}: CommandCenterDatePickerProps) {
  const t = useTranslations("commandCenter.daily.datePicker");

  const canGoPrev = dayKey > minDayKey && !loading;
  const canGoNext = dayKey < maxDayKey && !loading;
  const isToday = dayKey === todayKey;

  return (
    <div className={styles.datePicker} aria-busy={loading}>
      <span className={styles.datePickerLabel}>{t("label")}</span>
      <div className={styles.datePickerControls}>
        <Button
          type="button"
          variant="secondary"
          className={styles.datePickerNav}
          disabled={!canGoPrev}
          aria-label={t("prevDay")}
          onClick={() => onSelectDay(shiftActivityDayKey(dayKey, -1))}
        >
          ←
        </Button>
        <input
          type="date"
          className={styles.datePickerInput}
          value={dayKey}
          min={minDayKey}
          max={maxDayKey}
          disabled={loading}
          aria-label={t("label")}
          onChange={(event) => {
            const value = event.target.value;
            if (value) onSelectDay(value);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className={styles.datePickerNav}
          disabled={!canGoNext}
          aria-label={t("nextDay")}
          onClick={() => onSelectDay(shiftActivityDayKey(dayKey, 1))}
        >
          →
        </Button>
        {!isToday ? (
          <Button
            type="button"
            variant="ghost"
            className={styles.datePickerToday}
            disabled={loading}
            onClick={() => onSelectDay(todayKey)}
          >
            {t("today")}
          </Button>
        ) : null}
      </div>
      {loading ? (
        <span className={styles.datePickerStatus} role="status">
          {t("loading")}
        </span>
      ) : null}
    </div>
  );
}
