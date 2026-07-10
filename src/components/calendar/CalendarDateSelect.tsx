"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatAppDate, getMonthNames } from "@/i18n/format";
import {
  buildDateKey,
  buildYearOptions,
  daysInMonth,
  parseDateKey,
} from "@/lib/calendar/datetime-input";
import styles from "./CalendarDateTimeInput.module.css";

type CalendarDateSelectProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function CalendarDateSelect({ value, onChange, id }: CalendarDateSelectProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.dateSelect");
  const monthNames = useMemo(() => getMonthNames(locale, "long"), [locale]);

  const parsed = parseDateKey(value) ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  };

  const yearOptions = buildYearOptions(parsed.year);
  const dayOptions = Array.from(
    { length: daysInMonth(parsed.year, parsed.month) },
    (_, index) => index + 1,
  );

  const hintDate = useMemo(() => {
    const parts = parseDateKey(value);
    if (!parts) {
      return null;
    }
    return new Date(parts.year, parts.month - 1, parts.day);
  }, [value]);

  function update(parts: Partial<typeof parsed>) {
    const next = { ...parsed, ...parts };
    const maxDay = daysInMonth(next.year, next.month);
    if (next.day > maxDay) {
      next.day = maxDay;
    }
    onChange(buildDateKey(next));
  }

  return (
    <div className={styles.dateWrap} id={id}>
      <div className={styles.selectRow}>
        <select
          className={[styles.select, styles.selectDay].join(" ")}
          aria-label={t("dayAria")}
          value={parsed.day}
          onChange={(event) => update({ day: Number(event.target.value) })}
        >
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {String(day).padStart(2, "0")}
            </option>
          ))}
        </select>

        <select
          className={[styles.select, styles.selectMonth].join(" ")}
          aria-label={t("monthAria")}
          value={parsed.month}
          onChange={(event) => update({ month: Number(event.target.value) })}
        >
          {monthNames.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={[styles.select, styles.selectYear].join(" ")}
          aria-label={t("yearAria")}
          value={parsed.year}
          onChange={(event) => update({ year: Number(event.target.value) })}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {hintDate ? (
        <span className={styles.hint}>
          {formatAppDate(hintDate, locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      ) : (
        <span className={styles.hint}>{value}</span>
      )}
    </div>
  );
}
