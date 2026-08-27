import type { AppLocale } from "@/i18n/config";
import type { NotificationType } from "@/lib/notifications/types";
import { decodeCalendarReminderMessage } from "./calendar-reminder-copy";
import {
  decodeDemoNavMessage,
  getDemoNavHref,
} from "./notification-demo-nav";

export type NotificationSection =
  | "team-chat"
  | "tasks"
  | "calendar"
  | "meeting-recordings"
  | "ai-workspace"
  | "clients";

const TOAST_NOTIFICATION_TYPES = new Set<NotificationType>([
  "team_chat",
  "task_new",
  "task_status",
  "task_completed",
  "client_new",
  "consultation_assigned",
  "calendar_reminder",
  "calendar_video_invite",
  "meeting_recording_ready",
  "client_case_status",
  "client_agreement_update",
  "system",
]);

const CALENDAR_LINK_TYPES = new Set<NotificationType>([
  "calendar_reminder",
  "calendar_video_invite",
]);

function isCalendarLinkType(type: NotificationType): boolean {
  return CALENDAR_LINK_TYPES.has(type);
}

export function shouldShowNotificationToast(type: NotificationType): boolean {
  return TOAST_NOTIFICATION_TYPES.has(type);
}

export function getNotificationDisplayMessage(
  type: NotificationType,
  message: string,
): string {
  if (isCalendarLinkType(type)) {
    return decodeCalendarReminderMessage(message).display;
  }

  const demoNav = decodeDemoNavMessage(message);
  if (demoNav.href) {
    return demoNav.display;
  }

  return message;
}

export function getNotificationSection(
  type: NotificationType,
  message?: string,
): NotificationSection | null {
  const demoHref = message ? getDemoNavHref(message) : null;
  if (demoHref) {
    if (demoHref.startsWith("/ai-workspace")) return "ai-workspace";
    if (demoHref.startsWith("/clients/")) return "clients";
    if (demoHref.startsWith("/team-chat")) return "team-chat";
    if (demoHref.startsWith("/tasks")) return "tasks";
    if (demoHref.startsWith("/meeting-recordings")) return "meeting-recordings";
    if (demoHref.startsWith("/calendar")) return "calendar";
  }

  switch (type) {
    case "team_chat":
      return "team-chat";
    case "task_new":
    case "task_status":
    case "task_completed":
    case "task_pending_approval":
    case "task_revision":
      return "tasks";
    case "client_new":
    case "consultation_assigned":
      return "clients";
    case "calendar_reminder":
    case "calendar_video_invite":
      return "calendar";
    case "meeting_recording_ready":
      return "meeting-recordings";
    case "client_case_status":
    case "client_agreement_update":
      return "clients";
    case "system":
      return demoHref?.startsWith("/ai-workspace") ? "ai-workspace" : null;
    default:
      return null;
  }
}

export function getNotificationHref(
  type: NotificationType,
  message?: string,
): string | null {
  const demoHref = message ? getDemoNavHref(message) : null;
  if (demoHref) {
    return demoHref;
  }

  switch (type) {
    case "team_chat":
      return "/team-chat";
    case "task_new":
    case "task_status":
    case "task_completed":
    case "task_pending_approval":
    case "task_revision":
      return "/tasks";
    case "client_new":
    case "consultation_assigned":
      return "/clients";
    case "calendar_reminder":
    case "calendar_video_invite": {
      const { eventId, isVideoMeeting } = decodeCalendarReminderMessage(
        message ?? "",
      );
      if ((isVideoMeeting || type === "calendar_video_invite") && eventId) {
        return `/calendar/meet/${encodeURIComponent(eventId)}`;
      }
      return eventId
        ? `/calendar?event=${encodeURIComponent(eventId)}`
        : "/calendar";
    }
    case "meeting_recording_ready":
      return "/meeting-recordings";
    case "client_case_status":
    case "client_agreement_update":
      return "/client";
    default:
      return null;
  }
}

export function getNotificationActionLabel(
  type: NotificationType,
  message: string | undefined,
  locale: AppLocale,
  joinLabel: string,
): string | null {
  if (type === "calendar_video_invite") {
    return joinLabel;
  }

  if (type !== "calendar_reminder") {
    return null;
  }

  const { isVideoMeeting } = decodeCalendarReminderMessage(message ?? "");
  return isVideoMeeting ? joinLabel : null;
}

export function pathnameMatchesNotificationSection(
  pathname: string,
  section: NotificationSection,
): boolean {
  switch (section) {
    case "team-chat":
      return (
        pathname === "/team-chat" || pathname.startsWith("/team-chat/")
      );
    case "tasks":
      return pathname === "/tasks" || pathname.startsWith("/tasks/");
    case "calendar":
      return pathname === "/calendar" || pathname.startsWith("/calendar/");
    case "meeting-recordings":
      return (
        pathname === "/meeting-recordings" ||
        pathname.startsWith("/meeting-recordings/")
      );
    case "ai-workspace":
      return (
        pathname === "/ai-workspace" ||
        pathname.startsWith("/ai-workspace/")
      );
    case "clients":
      return pathname === "/clients" || pathname.startsWith("/clients/");
    default:
      return false;
  }
}

export function isOnNotificationSection(
  pathname: string,
  type: NotificationType,
  message?: string,
): boolean {
  const section = getNotificationSection(type, message);
  if (!section) return false;
  return pathnameMatchesNotificationSection(pathname, section);
}
