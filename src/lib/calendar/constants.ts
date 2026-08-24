export const CALENDAR_COMPANY_ID = "northstar-mobility";

export const CALENDAR_TIMEZONE = "Europe/Zagreb";

export const CALENDAR_SCOPE_COLORS = {
  personal: "#3B82F6",
  company: "#22C55E",
} as const;

export const CALENDAR_DEFAULT_EVENT_TYPE = "general" as const;

export const CALENDAR_EVENT_TYPE_LABELS = {
  general: "General event",
  video_meeting: "Video meeting",
} as const;

export const CALENDAR_DEFAULT_SEND_REMINDERS = true;

/** Fixed reminder offsets (minutes before effective event start). */
export const REMINDER_OFFSETS_MINUTES = [1440, 60, 10] as const;

export type ReminderOffsetMinutes = (typeof REMINDER_OFFSETS_MINUTES)[number];

/** GitHub Actions / Vercel cron interval in practice for long offsets (often 1–2 h). */
export const REMINDER_CRON_INTERVAL_MS = 3 * 60 * 60 * 1000;

/** How late a cron tick may still deliver on schedule (ideal fire time). */
export const REMINDER_GRACE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Upper bound of the fire window — how far ahead we pre-deliver before ideal fire time. */
export const REMINDER_CRON_WINDOW_MS = REMINDER_CRON_INTERVAL_MS;

/** 10-minute reminders must stay close to the meeting, not ride the 3h window. */
export const REMINDER_SHORT_OFFSET_MINUTES = 15;
export const REMINDER_SHORT_CRON_WINDOW_MS = 5 * 60 * 1000;
export const REMINDER_SHORT_GRACE_WINDOW_MS = 20 * 60 * 1000;

export function reminderWindowsForOffset(offsetMinutes: number): {
  graceWindowMs: number;
  cronWindowMs: number;
} {
  if (offsetMinutes <= REMINDER_SHORT_OFFSET_MINUTES) {
    return {
      graceWindowMs: REMINDER_SHORT_GRACE_WINDOW_MS,
      cronWindowMs: REMINDER_SHORT_CRON_WINDOW_MS,
    };
  }
  return {
    graceWindowMs: REMINDER_GRACE_WINDOW_MS,
    cronWindowMs: REMINDER_CRON_WINDOW_MS,
  };
}
