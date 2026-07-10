"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { getIntlLocaleTag } from "@/i18n/format";
import type { CalendarMeetingGuestAdmission } from "@/lib/calendar/types";
import styles from "./MeetingGuestHistory.module.css";

type MeetingGuestHistoryProps = {
  eventId: string;
};

export function MeetingGuestHistory({ eventId }: MeetingGuestHistoryProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.meet.guestHistory");
  const [admissions, setAdmissions] = useState<CalendarMeetingGuestAdmission[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusLabels: Record<CalendarMeetingGuestAdmission["status"], string> = {
    pending: t("statusPending"),
    admitted: t("statusAdmitted"),
    rejected: t("statusRejected"),
    left: t("statusLeft"),
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/calendar/events/${encodeURIComponent(eventId)}/guest-admissions?all=true`,
      );
      const payload = (await response.json()) as {
        admissions?: CalendarMeetingGuestAdmission[];
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? t("loadFailed"));
        setAdmissions([]);
        return;
      }

      setAdmissions(payload.admissions ?? []);
    } catch {
      setError(t("loadFailed"));
      setAdmissions([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const intlTag = getIntlLocaleTag(locale);

  if (loading) {
    return <p className={styles.status}>{t("loading")}</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (admissions.length === 0) {
    return <p className={styles.empty}>{t("empty")}</p>;
  }

  return (
    <section className={styles.section} aria-label={t("sectionAria")}>
      <h3 className={styles.title}>{t("title")}</h3>
      <ul className={styles.list}>
        {admissions.map((admission) => (
          <li key={admission.id} className={styles.item}>
            <span className={styles.name}>{admission.displayName}</span>
            <span className={styles.meta}>
              {statusLabels[admission.status]}
              {admission.decidedAt
                ? ` · ${new Date(admission.decidedAt).toLocaleString(intlTag)}`
                : ` · ${new Date(admission.createdAt).toLocaleString(intlTag)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
