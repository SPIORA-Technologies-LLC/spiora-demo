import type { AppLocale } from "./config";
import { translateCalendarMessage } from "./calendar-enums";

export type NotificationTypeKey =
  | "team_chat"
  | "task_new"
  | "task_status"
  | "task_completed"
  | "task_pending_approval"
  | "task_revision"
  | "client_new"
  | "consultation_assigned"
  | "calendar_reminder"
  | "calendar_video_invite"
  | "system";

export function translateNotificationType(
  locale: AppLocale,
  type: NotificationTypeKey,
): string {
  return translateCalendarMessage(locale, `notifications.types.${type}`);
}

export function formatNotificationTime(
  iso: string,
  locale: AppLocale = "en",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const intlTag = locale === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(intlTag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
