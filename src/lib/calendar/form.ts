import {
  CALENDAR_DEFAULT_EVENT_TYPE,
  CALENDAR_DEFAULT_SEND_REMINDERS,
  CALENDAR_TIMEZONE,
} from "./constants";
import { buildTimeValue } from "./datetime-input";
import type { CalendarExternalInvitee } from "./external-invitees";
import { addDaysToDateKey, formatDateKey } from "./range";
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarScope,
  VideoInviteMode,
} from "./types";
import { formatTimeInZone, getZonedParts, zonedDateTimeToUtc } from "./zoned-time";

/** Matches CalendarTimeSelect minute options. */
const DEFAULT_TIME_MINUTE_STEP = 5;
const DEFAULT_EVENT_DURATION_MINUTES = 60;

export type CalendarFormValues = {
  scope: CalendarScope;
  eventType: CalendarEventType;
  videoInviteMode: VideoInviteMode;
  guestWaitingRoom: boolean;
  guestMaxCount: number;
  guestAccessPassword: string;
  linkedClientId: string | null;
  linkedClientName: string | null;
  externalInvitees: CalendarExternalInvitee[];
  participantUserIds: string[];
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  location: string;
  sendReminders: boolean;
};

function parseTimeValue(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Ceil local clock time to the next minute step so the start is not in the past
 * and matches the time picker options. Caps at the last slot of the day.
 */
export function defaultStartEndTimes(
  now: Date,
  timeZone: string = CALENDAR_TIMEZONE,
  minuteStep: number = DEFAULT_TIME_MINUTE_STEP,
  durationMinutes: number = DEFAULT_EVENT_DURATION_MINUTES,
): { startTime: string; endTime: string; endDayOffset: number } {
  const { hour, minute } = getZonedParts(now, timeZone);
  let startTotal = hour * 60 + minute;
  const remainder = startTotal % minuteStep;
  if (remainder !== 0) {
    startTotal += minuteStep - remainder;
  }
  if (startTotal >= 24 * 60) {
    startTotal = 24 * 60 - minuteStep;
  }

  const endTotal = startTotal + durationMinutes;
  const endDayOffset = Math.floor(endTotal / (24 * 60));
  const endWithinDay = endTotal % (24 * 60);

  return {
    startTime: buildTimeValue({
      hours: Math.floor(startTotal / 60),
      minutes: startTotal % 60,
    }),
    endTime: buildTimeValue({
      hours: Math.floor(endWithinDay / 60),
      minutes: endWithinDay % 60,
    }),
    endDayOffset,
  };
}

export function defaultFormValues(
  anchorDate: Date,
  timeZone: string = CALENDAR_TIMEZONE,
  now: Date = new Date(),
): CalendarFormValues {
  const dateKey = formatDateKey(anchorDate, timeZone);
  const { startTime, endTime, endDayOffset } = defaultStartEndTimes(
    now,
    timeZone,
  );
  const endDate =
    endDayOffset > 0
      ? addDaysToDateKey(dateKey, endDayOffset, timeZone)
      : dateKey;

  return {
    scope: "personal",
    eventType: CALENDAR_DEFAULT_EVENT_TYPE,
    videoInviteMode: "all_team",
    guestWaitingRoom: false,
    guestMaxCount: 10,
    guestAccessPassword: "",
    linkedClientId: null,
    linkedClientName: null,
    externalInvitees: [],
    participantUserIds: [],
    title: "",
    description: "",
    startDate: dateKey,
    startTime,
    endDate,
    endTime,
    allDay: false,
    location: "",
    sendReminders: CALENDAR_DEFAULT_SEND_REMINDERS,
  };
}

export function eventToFormValues(
  event: CalendarEvent,
  timeZone: string = CALENDAR_TIMEZONE,
): CalendarFormValues {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);

  return {
    scope: event.scope,
    eventType: event.eventType,
    videoInviteMode:
      event.videoInviteMode ??
      (event.scope === "company" ? "all_team" : "selected"),
    participantUserIds: [...(event.participantUserIds ?? [])],
    guestWaitingRoom: event.guestWaitingRoom ?? false,
    guestMaxCount: event.guestMaxCount ?? 10,
    guestAccessPassword: "",
    linkedClientId: event.linkedClientId,
    linkedClientName: event.linkedClientName,
    externalInvitees: [...(event.externalInvitees ?? [])],
    title: event.title,
    description: event.description,
    startDate: formatDateKey(start, timeZone),
    startTime: formatTimeInZone(start, timeZone),
    endDate: formatDateKey(end, timeZone),
    endTime: formatTimeInZone(end, timeZone),
    allDay: event.allDay,
    location: event.location,
    sendReminders: event.sendReminders,
  };
}

export function formValuesToTimestamps(
  values: CalendarFormValues,
  timeZone: string = CALENDAR_TIMEZONE,
): {
  startAt: string;
  endAt: string;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)) {
    throw new Error("Invalid start date");
  }

  // Video meetings are always same-day: end date follows start date.
  const endDate =
    values.eventType === "video_meeting" ? values.startDate : values.endDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Invalid end date");
  }

  if (values.allDay) {
    return {
      startAt: zonedDateTimeToUtc(
        values.startDate,
        { hours: 0, minutes: 0, seconds: 0 },
        timeZone,
      ).toISOString(),
      endAt: zonedDateTimeToUtc(
        endDate,
        { hours: 23, minutes: 59, seconds: 59 },
        timeZone,
      ).toISOString(),
    };
  }

  const startTime = parseTimeValue(values.startTime);
  const endTime = parseTimeValue(values.endTime);
  if (!startTime || !endTime) {
    throw new Error("Invalid time");
  }

  return {
    startAt: zonedDateTimeToUtc(
      values.startDate,
      { hours: startTime.hours, minutes: startTime.minutes, seconds: 0 },
      timeZone,
    ).toISOString(),
    endAt: zonedDateTimeToUtc(
      endDate,
      { hours: endTime.hours, minutes: endTime.minutes, seconds: 0 },
      timeZone,
    ).toISOString(),
  };
}

export type CalendarFormValidationCode =
  | "titleRequired"
  | "videoAllDay"
  | "endBeforeStart"
  | "invalidDateTime";

export function validateFormValues(
  values: CalendarFormValues,
  timeZone: string = CALENDAR_TIMEZONE,
): CalendarFormValidationCode | null {
  if (!values.title.trim()) {
    return "titleRequired";
  }

  if (values.eventType === "video_meeting" && values.allDay) {
    return "videoAllDay";
  }

  try {
    const { startAt, endAt } = formValuesToTimestamps(values, timeZone);
    if (endAt < startAt) {
      return "endBeforeStart";
    }
  } catch {
    return "invalidDateTime";
  }

  return null;
}

export function formValuesToCreatePayload(
  values: CalendarFormValues,
  timeZone: string = CALENDAR_TIMEZONE,
) {
  const { startAt, endAt } = formValuesToTimestamps(values, timeZone);

  return {
    scope: values.scope,
    eventType: values.eventType,
    videoInviteMode:
      values.eventType === "video_meeting"
        ? values.scope === "personal"
          ? "selected"
          : values.videoInviteMode
        : undefined,
    participantUserIds:
      values.eventType === "video_meeting" &&
      (values.scope === "personal" || values.videoInviteMode === "selected")
        ? values.participantUserIds
        : undefined,
    title: values.title.trim(),
    description: values.description.trim(),
    startAt,
    endAt,
    allDay: values.allDay,
    location: values.location.trim(),
    sendReminders: values.sendReminders,
    guestWaitingRoom:
      values.eventType === "video_meeting" ? values.guestWaitingRoom : undefined,
    guestMaxCount:
      values.eventType === "video_meeting" ? values.guestMaxCount : undefined,
    guestAccessPassword:
      values.eventType === "video_meeting" && values.guestAccessPassword.trim()
        ? values.guestAccessPassword.trim()
        : values.eventType === "video_meeting"
          ? null
          : undefined,
    linkedClientId:
      values.eventType === "video_meeting" ? values.linkedClientId : undefined,
    linkedClientName:
      values.eventType === "video_meeting" ? values.linkedClientName : undefined,
    externalInvitees:
      values.eventType === "video_meeting" ? values.externalInvitees : undefined,
  };
}

export function formValuesToUpdatePayload(
  values: CalendarFormValues,
  timeZone: string = CALENDAR_TIMEZONE,
) {
  const { startAt, endAt } = formValuesToTimestamps(values, timeZone);

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    startAt,
    endAt,
    allDay: values.allDay,
    location: values.location.trim(),
    sendReminders: values.sendReminders,
    guestWaitingRoom:
      values.eventType === "video_meeting" ? values.guestWaitingRoom : undefined,
    guestMaxCount:
      values.eventType === "video_meeting" ? values.guestMaxCount : undefined,
    guestAccessPassword:
      values.eventType === "video_meeting" && values.guestAccessPassword.trim()
        ? values.guestAccessPassword.trim()
        : values.eventType === "video_meeting"
          ? null
          : undefined,
    videoInviteMode:
      values.eventType === "video_meeting"
        ? values.scope === "personal"
          ? "selected"
          : values.videoInviteMode
        : undefined,
    participantUserIds:
      values.eventType === "video_meeting" &&
      (values.scope === "personal" || values.videoInviteMode === "selected")
        ? values.participantUserIds
        : undefined,
    linkedClientId:
      values.eventType === "video_meeting" ? values.linkedClientId : undefined,
    linkedClientName:
      values.eventType === "video_meeting" ? values.linkedClientName : undefined,
    externalInvitees:
      values.eventType === "video_meeting" ? values.externalInvitees : undefined,
  };
}
