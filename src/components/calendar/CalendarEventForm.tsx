"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { AppLocale } from "@/i18n/config";
import {
  translateCalendarEventType,
  translateCalendarScope,
  translateFormValidation,
  translateVideoInviteMode,
} from "@/i18n/calendar-enums";
import type { CalendarFormValues } from "@/lib/calendar/form";
import { validateFormValues } from "@/lib/calendar/form";
import {
  MAX_EXTERNAL_INVITEES,
  normalizeExternalInviteeEmail,
  normalizeExternalInviteeName,
} from "@/lib/calendar/external-invitees";
import type { CalendarEventType, CalendarScope, VideoInviteMode } from "@/lib/calendar/types";
import { CalendarDateSelect } from "./CalendarDateSelect";
import { CalendarTimeSelect } from "./CalendarTimeSelect";
import { CalendarClientPicker } from "./CalendarClientPicker";
import { useCalendarTimeZone } from "./CalendarTimeZoneContext";
import styles from "./CalendarEventForm.module.css";

export type { CalendarFormValues };

type TeamMemberOption = { id: string; name: string };

type CalendarEventFormProps = {
  initial: CalendarFormValues;
  mode: "create" | "edit";
  submitLabel: string;
  scopeLocked?: boolean;
  currentUserId: string;
  teamMembers: TeamMemberOption[];
  onSubmit: (values: CalendarFormValues) => Promise<void>;
  onCancel: () => void;
};

export function CalendarEventForm({
  initial,
  mode,
  submitLabel,
  scopeLocked = false,
  currentUserId,
  teamMembers,
  onSubmit,
  onCancel,
}: CalendarEventFormProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("calendar.form");
  const tToasts = useTranslations("calendar.toasts");
  const tActions = useTranslations("actions");
  const { timeZone } = useCalendarTimeZone();
  const [values, setValues] = useState<CalendarFormValues>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [externalNameDraft, setExternalNameDraft] = useState("");
  const [externalEmailDraft, setExternalEmailDraft] = useState("");
  const [externalAddError, setExternalAddError] = useState("");

  function addExternalInvitee() {
    const name = normalizeExternalInviteeName(externalNameDraft);
    if (!name) {
      setExternalAddError(t("externalInviteesNameInvalid"));
      return;
    }

    const emailRaw = externalEmailDraft.trim();
    const email = emailRaw
      ? normalizeExternalInviteeEmail(emailRaw)
      : null;
    if (emailRaw && !email) {
      setExternalAddError(t("externalInviteesEmailInvalid"));
      return;
    }

    if (values.externalInvitees.length >= MAX_EXTERNAL_INVITEES) {
      setExternalAddError(t("externalInviteesLimit"));
      return;
    }

    const duplicate = values.externalInvitees.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        (item.email ?? "") === (email ?? ""),
    );
    if (duplicate) {
      setExternalAddError(t("externalInviteesDuplicate"));
      return;
    }

    setValues((current) => ({
      ...current,
      externalInvitees: [...current.externalInvitees, { name, email }],
    }));
    setExternalNameDraft("");
    setExternalEmailDraft("");
    setExternalAddError("");
  }

  function removeExternalInvitee(index: number) {
    setValues((current) => ({
      ...current,
      externalInvitees: current.externalInvitees.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationCode = validateFormValues(values, timeZone);
    if (validationCode) {
      setError(translateFormValidation(locale, validationCode));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : tToasts("saveFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function setScope(scope: CalendarScope) {
    if (scopeLocked) {
      return;
    }
    setValues((current) => ({
      ...current,
      scope,
      videoInviteMode: scope === "personal" ? "selected" : current.videoInviteMode,
    }));
  }

  function setEventType(eventType: CalendarEventType) {
    if (mode !== "create") {
      return;
    }
    setValues((current) => ({
      ...current,
      eventType,
      allDay: eventType === "video_meeting" ? false : current.allDay,
      // Video calls stay on one calendar day — end date follows start.
      endDate:
        eventType === "video_meeting" ? current.startDate : current.endDate,
      videoInviteMode:
        eventType === "video_meeting"
          ? current.scope === "personal"
            ? "selected"
            : current.videoInviteMode
          : "all_team",
      participantUserIds:
        eventType === "video_meeting" ? current.participantUserIds : [],
      externalInvitees:
        eventType === "video_meeting" ? current.externalInvitees : [],
    }));
  }

  function setStartDate(startDate: string) {
    setValues((current) => ({
      ...current,
      startDate,
      endDate:
        current.eventType === "video_meeting" ? startDate : current.endDate,
    }));
  }

  function setVideoInviteMode(videoInviteMode: VideoInviteMode) {
    setValues((current) => ({
      ...current,
      videoInviteMode,
      participantUserIds:
        videoInviteMode === "all_team" ? [] : current.participantUserIds,
    }));
  }

  const inviteCandidates = teamMembers.filter(
    (member) => member.id !== currentUserId,
  );
  const showInviteModeSwitch =
    values.eventType === "video_meeting" && values.scope === "company";
  const showParticipantPicker =
    values.eventType === "video_meeting" &&
    (values.scope === "personal" || values.videoInviteMode === "selected");

  return (
    <form className={styles.form} onSubmit={(submitEvent) => void handleSubmit(submitEvent)}>
      {mode === "create" ? (
        <fieldset className={styles.scopeFieldset}>
          <legend className={styles.label}>{t("scopeLegend")}</legend>
          <div className={styles.scopeSwitch}>
            <button
              type="button"
              className={[
                styles.scopeButton,
                values.scope === "personal" ? styles.scopePersonal : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={values.scope === "personal"}
              onClick={() => setScope("personal")}
            >
              {translateCalendarScope(locale, "personal")}
            </button>
            <button
              type="button"
              className={[
                styles.scopeButton,
                values.scope === "company" ? styles.scopeCompany : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={values.scope === "company"}
              onClick={() => setScope("company")}
            >
              {translateCalendarScope(locale, "company")}
            </button>
          </div>
        </fieldset>
      ) : (
        <div className={styles.readonlyScope}>
          <span className={styles.label}>{t("scopeType")}</span>
          <span
            className={[
              styles.scopeBadge,
              values.scope === "personal" ? styles.scopePersonal : styles.scopeCompany,
            ].join(" ")}
          >
            {translateCalendarScope(locale, values.scope)}
          </span>
        </div>
      )}

      {mode === "create" ? (
        <fieldset className={styles.formatFieldset}>
          <legend className={styles.label}>{t("formatLegend")}</legend>
          <div className={styles.formatSwitch}>
            <button
              type="button"
              className={[
                styles.formatButton,
                values.eventType === "general" ? styles.formatGeneral : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={values.eventType === "general"}
              onClick={() => setEventType("general")}
            >
              {translateCalendarEventType(locale, "general")}
            </button>
            <button
              type="button"
              className={[
                styles.formatButton,
                values.eventType === "video_meeting" ? styles.formatVideo : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={values.eventType === "video_meeting"}
              onClick={() => setEventType("video_meeting")}
            >
              {translateCalendarEventType(locale, "video_meeting")}
            </button>
          </div>
          {values.eventType === "video_meeting" ? (
            <p className={styles.fieldHint}>{t("videoHint")}</p>
          ) : null}
        </fieldset>
      ) : values.eventType === "video_meeting" ? (
        <div className={styles.readonlyScope}>
          <span className={styles.label}>{t("formatType")}</span>
          <span className={[styles.formatBadge, styles.formatVideo].join(" ")}>
            {translateCalendarEventType(locale, "video_meeting")}
          </span>
        </div>
      ) : null}

      {showInviteModeSwitch ? (
        <fieldset className={styles.inviteFieldset}>
          <legend className={styles.label}>{t("inviteLegend")}</legend>
          <div className={styles.inviteSwitch}>
            <button
              type="button"
              className={[
                styles.inviteButton,
                values.videoInviteMode === "all_team" ? styles.inviteAllTeam : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={values.videoInviteMode === "all_team"}
              onClick={() => setVideoInviteMode("all_team")}
            >
              {translateVideoInviteMode(locale, "all_team")}
            </button>
            <button
              type="button"
              className={[
                styles.inviteButton,
                values.videoInviteMode === "selected" ? styles.inviteSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={values.videoInviteMode === "selected"}
              onClick={() => setVideoInviteMode("selected")}
            >
              {translateVideoInviteMode(locale, "selected")}
            </button>
          </div>
        </fieldset>
      ) : null}

      {showParticipantPicker ? (
        <fieldset className={styles.inviteFieldset}>
          <legend className={styles.label}>{t("participantsLegend")}</legend>
          <p className={styles.fieldHintInline}>{t("participantsHint")}</p>
          <div className={styles.participantList}>
            {inviteCandidates.map((member) => {
              const checked = values.participantUserIds.includes(member.id);
              return (
                <label key={member.id} className={styles.participantItem}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(changeEvent) => {
                      setValues((current) => ({
                        ...current,
                        participantUserIds: changeEvent.target.checked
                          ? [...current.participantUserIds, member.id]
                          : current.participantUserIds.filter(
                              (id) => id !== member.id,
                            ),
                      }));
                    }}
                  />
                  <span>{member.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {values.eventType === "video_meeting" ? (
        <fieldset className={styles.inviteFieldset}>
          <legend className={styles.label}>{t("externalInviteesLegend")}</legend>
          <p className={styles.fieldHintInline}>{t("externalInviteesHint")}</p>
          {values.externalInvitees.length > 0 ? (
            <ul className={styles.externalInviteeList}>
              {values.externalInvitees.map((invitee, index) => (
                <li key={`${invitee.name}-${invitee.email ?? ""}-${index}`} className={styles.externalInviteeItem}>
                  <span className={styles.externalInviteeText}>
                    {invitee.name}
                    {invitee.email ? (
                      <span className={styles.externalInviteeEmail}>
                        {invitee.email}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={styles.externalInviteeRemove}
                    onClick={() => removeExternalInvitee(index)}
                    aria-label={t("externalInviteesRemoveAria", {
                      name: invitee.name,
                    })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.externalInviteeAdd}>
            <input
              className={styles.input}
              type="text"
              value={externalNameDraft}
              onChange={(changeEvent) => {
                setExternalNameDraft(changeEvent.target.value);
                setExternalAddError("");
              }}
              placeholder={t("externalInviteesNamePlaceholder")}
              aria-label={t("externalInviteesNamePlaceholder")}
              maxLength={80}
            />
            <input
              className={styles.input}
              type="email"
              value={externalEmailDraft}
              onChange={(changeEvent) => {
                setExternalEmailDraft(changeEvent.target.value);
                setExternalAddError("");
              }}
              placeholder={t("externalInviteesEmailPlaceholder")}
              aria-label={t("externalInviteesEmailPlaceholder")}
              maxLength={254}
            />
            <button
              type="button"
              className={styles.externalInviteeAddButton}
              onClick={addExternalInvitee}
            >
              {t("externalInviteesAdd")}
            </button>
          </div>
          {externalAddError ? (
            <p className={styles.error}>{externalAddError}</p>
          ) : null}
        </fieldset>
      ) : null}

      {values.eventType === "video_meeting" ? (
        <CalendarClientPicker
          clientId={values.linkedClientId}
          clientName={values.linkedClientName}
          onChange={({ clientId, clientName }) =>
            setValues({
              ...values,
              linkedClientId: clientId,
              linkedClientName: clientName,
            })
          }
        />
      ) : null}

      {values.eventType === "video_meeting" ? (
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={values.guestWaitingRoom}
            onChange={(changeEvent) =>
              setValues({
                ...values,
                guestWaitingRoom: changeEvent.target.checked,
              })
            }
          />
          <span>{t("waitingRoom")}</span>
        </label>
      ) : null}

      {values.eventType === "video_meeting" ? (
        <label className={styles.field}>
          <span className={styles.label}>{t("guestMax")}</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={50}
            value={values.guestMaxCount ?? 10}
            onChange={(changeEvent) =>
              setValues({
                ...values,
                guestMaxCount: Number(changeEvent.target.value) || 10,
              })
            }
          />
        </label>
      ) : null}

      {values.eventType === "video_meeting" ? (
        <label className={styles.field}>
          <span className={styles.label}>{t("guestPassword")}</span>
          <input
            className={styles.input}
            type="password"
            value={values.guestAccessPassword}
            onChange={(changeEvent) =>
              setValues({
                ...values,
                guestAccessPassword: changeEvent.target.value,
              })
            }
            placeholder={
              mode === "edit"
                ? t("guestPasswordEditPlaceholder")
                : t("guestPasswordCreatePlaceholder")
            }
            autoComplete="new-password"
          />
        </label>
      ) : null}

      <label className={styles.field}>
        <span className={styles.label}>{t("title")}</span>
        <input
          className={styles.input}
          value={values.title}
          onChange={(changeEvent) =>
            setValues({ ...values, title: changeEvent.target.value })
          }
          placeholder={t("titlePlaceholder")}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t("description")}</span>
        <textarea
          className={styles.textarea}
          value={values.description}
          onChange={(changeEvent) =>
            setValues({ ...values, description: changeEvent.target.value })
          }
          rows={3}
          placeholder={t("descriptionPlaceholder")}
        />
      </label>

      {values.eventType !== "video_meeting" ? (
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={values.allDay}
            onChange={(changeEvent) =>
              setValues({ ...values, allDay: changeEvent.target.checked })
            }
          />
          <span>{t("allDay")}</span>
        </label>
      ) : null}

      <section className={styles.dateTimeSection} aria-labelledby="calendar-datetime-heading">
        <h3 id="calendar-datetime-heading" className={styles.sectionTitle}>
          {t("when")}
        </h3>

        <div className={styles.dateTimeGrid}>
          <div className={styles.field}>
            <span className={styles.label}>{t("start")}</span>
            <CalendarDateSelect
              value={values.startDate}
              onChange={setStartDate}
            />
            {!values.allDay ? (
              <CalendarTimeSelect
                value={values.startTime}
                onChange={(startTime) => setValues({ ...values, startTime })}
              />
            ) : null}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{t("end")}</span>
            {values.eventType !== "video_meeting" ? (
              <CalendarDateSelect
                value={values.endDate}
                onChange={(endDate) => setValues({ ...values, endDate })}
              />
            ) : null}
            {!values.allDay ? (
              <CalendarTimeSelect
                value={values.endTime}
                onChange={(endTime) => setValues({ ...values, endTime })}
              />
            ) : null}
          </div>
        </div>
      </section>

      <label className={styles.field}>
        <span className={styles.label}>{t("location")}</span>
        <input
          className={styles.input}
          value={values.location}
          onChange={(changeEvent) =>
            setValues({ ...values, location: changeEvent.target.value })
          }
          placeholder={t("locationPlaceholder")}
        />
      </label>

      <div className={styles.remindersField}>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={values.sendReminders}
            onChange={(changeEvent) =>
              setValues({ ...values, sendReminders: changeEvent.target.checked })
            }
          />
          <span>{t("reminders")}</span>
        </label>
        <p className={styles.fieldHint}>{t("remindersHint")}</p>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {tActions("cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? t("saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
