"use client";

import { useLocale, useTranslations } from "next-intl";
import { CALENDAR_SCOPE_COLORS } from "@/lib/calendar/constants";
import { translateCalendarScope } from "@/i18n/calendar-enums";
import type { AppLocale } from "@/i18n/config";
import type { CalendarLayers } from "@/lib/calendar/layers";
import styles from "./CalendarLayerFilters.module.css";

export type CalendarLayerFiltersProps = {
  layers: CalendarLayers;
  onChange: (layers: CalendarLayers) => void;
};

export function CalendarLayerFilters({
  layers,
  onChange,
}: CalendarLayerFiltersProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.layers");

  const bothOff = !layers.personal && !layers.company;

  return (
    <div className={styles.row}>
      <div className={styles.filters}>
        <label className={styles.filterItem}>
          <input
            type="checkbox"
            checked={layers.personal}
            onChange={(event) =>
              onChange({ ...layers, personal: event.target.checked })
            }
          />
          <span>
            <strong>{t("personalTitle")}</strong>
            <small>{t("personalSubtitle")}</small>
          </span>
        </label>

        <label className={styles.filterItem}>
          <input
            type="checkbox"
            checked={layers.company}
            onChange={(event) =>
              onChange({ ...layers, company: event.target.checked })
            }
          />
          <span>
            <strong>{t("companyTitle")}</strong>
            <small>{t("companySubtitle")}</small>
          </span>
        </label>

        {bothOff ? (
          <p className={styles.warning} role="status">
            {t("selectAtLeastOne")}
          </p>
        ) : null}
      </div>

      <div className={styles.legend} aria-label={t("legendAria")}>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ backgroundColor: CALENDAR_SCOPE_COLORS.personal }}
          />
          {translateCalendarScope(locale, "personal")}
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ backgroundColor: CALENDAR_SCOPE_COLORS.company }}
          />
          {translateCalendarScope(locale, "company")}
        </span>
      </div>
    </div>
  );
}
