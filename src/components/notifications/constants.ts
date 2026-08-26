import type { NotificationItem } from "./notification-context";

export const NOTIFICATION_TYPE_ICONS: Record<NotificationItem["type"], string> =
  {
    team_chat: "💬",
    task_new: "📋",
    task_status: "📋",
    task_completed: "✅",
    task_pending_approval: "👀",
    task_revision: "🔄",
    client_new: "👤",
    consultation_assigned: "📅",
    calendar_reminder: "📅",
    calendar_video_invite: "📹",
    meeting_recording_ready: "🎥",
    client_case_status: "📁",
    client_agreement_update: "📝",
    system: "🔔",
  };

export function isSuccessNotification(type: NotificationItem["type"]): boolean {
  return type === "task_completed" || type === "task_pending_approval";
}
