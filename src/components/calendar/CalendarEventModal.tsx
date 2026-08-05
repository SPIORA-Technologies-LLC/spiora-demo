"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MeetingJoinButton } from "@/components/meet/MeetingJoinButton";
import { MeetingGuestInviteLink } from "@/components/meet/MeetingGuestInviteLink";
import { MeetingGuestHistory } from "@/components/meet/MeetingGuestHistory";
import type { AppLocale } from "@/i18n/config";
import { translateCalendarEventType } from "@/i18n/calendar-enums";
import { resolveCalendarEventTitle } from "@/lib/calendar/demo-event-title";
import type { SessionUser } from "@/lib/auth/types";
import {
  formatEventTimeRange,
  formatScopeLabel,
} from "@/lib/calendar/format";
import {
  formatMeetingStatusLabel,
  getMeetingAccessPhase,
} from "@/lib/calendar/meeting-client";
import { getMeetingRoomName, isVideoMeeting } from "@/lib/calendar/meeting";
import { formatParticipantNames } from "@/lib/calendar/participants";
import {
  canDeleteEvent,
  canEditEvent,
} from "@/lib/calendar/permissions-client";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarTimeZone } from "./CalendarTimeZoneContext";
import styles from "./CalendarEventModal.module.css";

type CalendarEventModalProps = {
  event: CalendarEvent;
  user: SessionUser;
  teamMembers: { id: string; name: string }[];
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
};

function meetingStatusClass(phase: ReturnType<typeof getMeetingAccessPhase>): string {
  switch (phase) {
    case "open":
      return styles.statusOpen;
    case "waiting":
      return styles.statusWaiting;
    case "closed":
      return styles.statusClosed;
  }
}

export function CalendarEventModal({
  event,
  user,
  teamMembers,
  onClose,
  onEdit,
  onDelete,
}: CalendarEventModalProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.modal");
  const tDialogs = useTranslations("calendar.dialogs");
  const tActions = useTranslations("actions");
  const { timeZone } = useCalendarTimeZone();
  const canEdit = canEditEvent(user, event);
  const canDelete = canDeleteEvent(user, event);
  const scopeClass =
    event.scope === "personal" ? styles.scopePersonal : styles.scopeCompany;
  const videoMeeting = isVideoMeeting(event);
  const meetingPhase = videoMeeting ? getMeetingAccessPhase(event) : null;
  const displayTitle = resolveCalendarEventTitle(event.title, locale);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="calendar-event-title">
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <Card className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.badges}>
              {videoMeeting ? (
                <span className={[styles.typeBadge, styles.typeVideo].join(" ")}>
                  {translateCalendarEventType(locale, "video_meeting")}
                </span>
              ) : null}
              <span className={[styles.scopeBadge, scopeClass].join(" ")}>
                {formatScopeLabel(event.scope, locale)}
              </span>
            </div>
            <h2 id="calendar-event-title" className={styles.title}>
              {displayTitle}
            </h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={tDialogs("closeAria")}>
            ×
          </button>
        </header>

        <dl className={styles.meta}>
          <div>
            <dt>{t("time")}</dt>
            <dd>{formatEventTimeRange(event, timeZone, locale)}</dd>
          </div>
          {videoMeeting ? (
            <>
              <div>
                <dt>{t("room")}</dt>
                <dd className={styles.roomName}>{getMeetingRoomName(event.id)}</dd>
              </div>
              <div>
                <dt>{t("participants")}</dt>
                <dd>{formatParticipantNames(event, teamMembers, locale)}</dd>
              </div>
              <div>
                <dt>{t("guestLimit")}</dt>
                <dd>{event.guestMaxCount ?? t("noGuestLimit")}</dd>
              </div>
              <div>
                <dt>{t("guestPassword")}</dt>
                <dd>{event.guestAccessPasswordSet ? t("passwordSet") : t("passwordNotSet")}</dd>
              </div>
              <div>
                <dt>{t("waitingRoom")}</dt>
                <dd>{event.guestWaitingRoom ? t("waitingRoomOn") : t("waitingRoomOff")}</dd>
              </div>
              {event.linkedClientId ? (
                <div>
                  <dt>{t("client")}</dt>
                  <dd>
                    <a
                      className={styles.clientLink}
                      href={`/clients/${encodeURIComponent(event.linkedClientId)}`}
                    >
                      {event.linkedClientName ?? event.linkedClientId}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>{t("externalInvitees")}</dt>
                <dd>
                  {(event.externalInvitees ?? []).length > 0
                    ? event.externalInvitees
                        .map((invitee) =>
                          invitee.email
                            ? `${invitee.name} (${invitee.email})`
                            : invitee.name,
                        )
                        .join(", ")
                    : t("externalInviteesEmpty")}
                </dd>
              </div>
              <div>
                <dt>{t("status")}</dt>
                <dd>
                  <span
                    className={[
                      styles.statusBadge,
                      meetingPhase ? meetingStatusClass(meetingPhase) : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {meetingPhase ? formatMeetingStatusLabel(meetingPhase, locale) : "—"}
                  </span>
                </dd>
              </div>
            </>
          ) : null}
          {event.location ? (
            <div>
              <dt>{t("location")}</dt>
              <dd>{event.location}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t("author")}</dt>
            <dd>{event.createdByName}</dd>
          </div>
          <div>
            <dt>{t("reminders")}</dt>
            <dd>{event.sendReminders ? t("remindersOn") : t("remindersOff")}</dd>
          </div>
        </dl>

        {videoMeeting ? (
          <>
            <MeetingJoinButton event={event} timeZone={timeZone} />
            <MeetingGuestInviteLink event={event} canRegenerate={canEdit} />
            <MeetingGuestHistory eventId={event.id} />
          </>
        ) : null}

        {event.description ? (
          <p className={styles.description}>{event.description}</p>
        ) : (
          <p className={styles.noDescription}>{t("noDescription")}</p>
        )}

        <div className={styles.actions}>
          {canEdit ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onClose();
                onEdit(event);
              }}
            >
              {tActions("edit")}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                onClose();
                onDelete(event);
              }}
            >
              {tActions("delete")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            {tActions("close")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
