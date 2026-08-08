"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatMonthDayYear, getMonthNames } from "@/i18n/format";
import {
  buildDateKey,
  buildYearOptions,
  CALENDAR_MONTHS_RU,
  daysInMonth,
  parseDateKey,
} from "@/lib/calendar/datetime-input";
import styles from "./CalendarDateTimeInput.module.css";

type CalendarDateSelectProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** When true, empty `value` stays empty until the user picks all parts. */
  allowEmpty?: boolean;
};

export function CalendarDateSelect({
  value,
  onChange,
  id,
  allowEmpty = false,
}: CalendarDateSelectProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.dateSelect");
  const monthNames = useMemo(() => {
    if (locale === "ru") {
      return [...CALENDAR_MONTHS_RU];
    }
    return getMonthNames(locale, "long");
  }, [locale]);

  const parsed = parseDateKey(value);
  const fallback = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  };
  const isEmpty = allowEmpty && !parsed;
  const current = parsed ?? fallback;

  const yearOptions = buildYearOptions(current.year);
  const dayOptions = Array.from(
    { length: daysInMonth(current.year, current.month || 1) },
    (_, index) => index + 1,
  );

  const hintDate = useMemo(() => {
    if (!parsed) {
      return null;
    }
    return new Date(parsed.year, parsed.month - 1, parsed.day);
  }, [parsed]);

  function update(parts: Partial<typeof current>) {
    const next = {
      year: parts.year ?? current.year,
      month: parts.month ?? current.month,
      day: parts.day ?? current.day,
    };
    if (isEmpty) {
      next.year = parts.year ?? fallback.year;
      next.month = parts.month ?? fallback.month;
      next.day = parts.day ?? fallback.day;
    }
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
          className={[styles.select, styles.selectMonth].join(" ")}
          aria-label={t("monthAria")}
          value={isEmpty ? "" : current.month}
          onChange={(event) => update({ month: Number(event.target.value) })}
        >
          {isEmpty ? <option value="">{t("monthAria")}</option> : null}
          {monthNames.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={[styles.select, styles.selectDay].join(" ")}
          aria-label={t("dayAria")}
          value={isEmpty ? "" : current.day}
          onChange={(event) => update({ day: Number(event.target.value) })}
        >
          {isEmpty ? <option value="">{t("dayAria")}</option> : null}
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {String(day).padStart(2, "0")}
            </option>
          ))}
        </select>

        <select
          className={[styles.select, styles.selectYear].join(" ")}
          aria-label={t("yearAria")}
          value={isEmpty ? "" : current.year}
          onChange={(event) => update({ year: Number(event.target.value) })}
        >
          {isEmpty ? <option value="">{t("yearAria")}</option> : null}
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {hintDate ? (
        <span className={styles.hint}>
          {formatMonthDayYear(hintDate, locale)}
        </span>
      ) : null}
    </div>
  );
}
