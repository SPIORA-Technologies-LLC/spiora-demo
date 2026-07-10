"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { useCalendarTimeZone } from "@/components/calendar/CalendarTimeZoneContext";
import { resolveCalendarEventTitle } from "@/lib/calendar/demo-event-title";
import { buildGuestMeetingInviteText } from "@/lib/calendar/meeting-guest-invite-message";
import {
  buildMailtoShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/calendar/meeting-guest-invite-share";
import type { CalendarEvent } from "@/lib/calendar/types";
import styles from "./MeetingGuestInviteLink.module.css";

type MeetingGuestInviteLinkProps = {
  event: CalendarEvent;
  canRegenerate: boolean;
};

export function MeetingGuestInviteLink({
  event,
  canRegenerate,
}: MeetingGuestInviteLinkProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.meet.guestInvite");
  const { timeZone } = useCalendarTimeZone();
  const [guestJoinUrl, setGuestJoinUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [linkedClientEmail, setLinkedClientEmail] = useState<string | null>(null);
  const [linkedClientPhone, setLinkedClientPhone] = useState<string | null>(null);

  const displayTitle = resolveCalendarEventTitle(event.title, locale);

  const inviteText = useMemo(() => {
    if (!guestJoinUrl) {
      return "";
    }

    return buildGuestMeetingInviteText(event, guestJoinUrl, {
      recipientName: event.linkedClientName,
      timeZone,
      locale,
    });
  }, [event, guestJoinUrl, locale, timeZone]);

  const loadInvite = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/calendar/events/${encodeURIComponent(event.id)}/guest-invite`,
      );
      const payload = (await response.json()) as {
        guestJoinUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? t("loadFailed"));
        setGuestJoinUrl(null);
        return;
      }

      setGuestJoinUrl(payload.guestJoinUrl ?? null);
    } catch {
      setError(t("loadFailed"));
      setGuestJoinUrl(null);
    } finally {
      setLoading(false);
    }
  }, [event.id, t]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  useEffect(() => {
    if (!event.linkedClientId) {
      setLinkedClientEmail(null);
      setLinkedClientPhone(null);
      return;
    }

    void fetch(`/api/clients/${encodeURIComponent(event.linkedClientId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          client?: { email?: string; phone?: string };
        };
        if (response.ok) {
          setLinkedClientEmail(payload.client?.email?.trim() || null);
          setLinkedClientPhone(payload.client?.phone?.trim() || null);
        }
      })
      .catch(() => {
        setLinkedClientEmail(null);
        setLinkedClientPhone(null);
      });
  }, [event.linkedClientId]);

  const mailtoUrl = useMemo(() => {
    if (!inviteText) {
      return null;
    }

    return buildMailtoShareUrl(inviteText, {
      subject: t("emailSubject", { title: displayTitle }),
      recipientEmail: linkedClientEmail,
    });
  }, [displayTitle, inviteText, linkedClientEmail, t]);

  const whatsAppUrl = useMemo(() => {
    if (!inviteText) {
      return null;
    }

    return buildWhatsAppShareUrl(inviteText, linkedClientPhone);
  }, [inviteText, linkedClientPhone]);

  const telegramUrl = useMemo(() => {
    if (!inviteText || !guestJoinUrl) {
      return null;
    }

    return buildTelegramShareUrl(inviteText, guestJoinUrl);
  }, [guestJoinUrl, inviteText]);

  async function handleCopyInvite() {
    if (!inviteText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("copyPrompt"), inviteText);
    }
  }

  async function handleRegenerate() {
    if (!canRegenerate || regenerating) {
      return;
    }

    const confirmed = window.confirm(t("regenerateConfirm"));
    if (!confirmed) {
      return;
    }

    setRegenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/calendar/events/${encodeURIComponent(event.id)}/guest-invite/regenerate`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        guestJoinUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? t("regenerateFailed"));
        return;
      }

      setGuestJoinUrl(payload.guestJoinUrl ?? null);
    } catch {
      setError(t("regenerateFailed"));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className={styles.section} aria-label={t("sectionAria")}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t("title")}</h3>
        <p className={styles.hint}>{t("hint")}</p>
      </div>

      {loading ? (
        <p className={styles.status}>{t("loading")}</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : guestJoinUrl ? (
        <>
          <textarea
            className={styles.invitePreview}
            value={inviteText}
            readOnly
            rows={10}
            aria-label={t("inviteAria")}
            onFocus={(focusEvent) => focusEvent.currentTarget.select()}
          />
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => void handleCopyInvite()}
            >
              {copied ? t("copied") : t("copyInvite")}
            </button>
            <a
              className={styles.shareButton}
              href={mailtoUrl ?? undefined}
              aria-disabled={!inviteText}
              onClick={(clickEvent) => {
                if (!inviteText) {
                  clickEvent.preventDefault();
                }
              }}
            >
              {t("email")}
            </a>
            <a
              className={`${styles.shareButton} ${styles.shareButtonWhatsapp}`}
              href={whatsAppUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!inviteText}
              onClick={(clickEvent) => {
                if (!inviteText) {
                  clickEvent.preventDefault();
                }
              }}
            >
              {t("whatsapp")}
            </a>
            <a
              className={`${styles.shareButton} ${styles.shareButtonTelegram}`}
              href={telegramUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!inviteText}
              onClick={(clickEvent) => {
                if (!inviteText) {
                  clickEvent.preventDefault();
                }
              }}
            >
              {t("telegram")}
            </a>
          </div>
        </>
      ) : null}

      {canRegenerate && !loading ? (
        <div className={styles.regenerateBlock}>
          <button
            type="button"
            className={styles.regenerateButton}
            onClick={() => void handleRegenerate()}
            disabled={regenerating}
          >
            {regenerating ? t("regenerating") : t("regenerate")}
          </button>
          <p className={styles.regenerateHint}>{t("regenerateHint")}</p>
        </div>
      ) : null}
    </section>
  );
}
