import "server-only";

import { listActiveCalendarUserIds } from "@/lib/calendar/active-users";
import { resolveReminderRecipientIds } from "@/lib/calendar/reminders";
import type { CalendarEvent } from "@/lib/calendar/types";
import { isVideoMeeting } from "@/lib/calendar/meeting";
import type { ReminderOffsetMinutes } from "@/lib/calendar/constants";
import { getRequestLocale } from "@/i18n/api-messages";
import {
  translateNotificationEmit,
  translateTaskStatusForNotification,
  translateTeamChatPreview,
} from "@/i18n/notification-emit-messages";
import type { TaskStatus } from "@/lib/tasks/types";
import {
  buildCalendarReminderNotificationContent,
  buildCalendarEventCreatedNotificationContent,
} from "./calendar-reminder-copy";
import {
  createNotificationForUser,
  createNotificationsForTeam,
  createNotificationsForUserIds,
} from "./store";
import type { Notification } from "./types";

function buildTeamChatPreview(
  locale: Awaited<ReturnType<typeof getRequestLocale>>,
  params: {
    text: string;
    isVoice?: boolean;
    isImage?: boolean;
    isFile?: boolean;
  },
): string {
  if (params.isVoice) {
    return translateTeamChatPreview(locale, "voice");
  }
  if (params.isImage) {
    const caption = params.text.trim();
    return caption
      ? translateTeamChatPreview(locale, "imageWithCaption", caption)
      : translateTeamChatPreview(locale, "image");
  }
  if (params.isFile) {
    const caption = params.text.trim();
    return caption
      ? translateTeamChatPreview(locale, "fileWithCaption", caption)
      : translateTeamChatPreview(locale, "file");
  }
  return params.text.length > 200
    ? `${params.text.slice(0, 200)}…`
    : params.text;
}

export async function notifyTeamChatMessage(params: {
  senderId: string;
  senderName: string;
  text: string;
  isVoice?: boolean;
  isImage?: boolean;
  isFile?: boolean;
}) {
  const locale = await getRequestLocale();
  const preview = buildTeamChatPreview(locale, params);

  await createNotificationsForTeam(
    {
      type: "team_chat",
      title: translateNotificationEmit(locale, "notifyTeamChatMessage.title"),
      author_name: params.senderName,
      message: preview,
    },
    { excludeUserId: params.senderId },
  );
}

export async function notifyTaskCreated(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  assigneeIds?: string[];
}) {
  const locale = await getRequestLocale();
  const hasAssignees = Boolean(params.assigneeIds?.length);

  await createNotificationsForTeam(
    {
      type: "task_new",
      title: hasAssignees
        ? translateNotificationEmit(locale, "taskCreated.titleAssigned")
        : translateNotificationEmit(locale, "taskCreated.title"),
      author_name: params.actorName,
      message: params.taskTitle,
    },
    {
      excludeUserId: params.actorId,
      onlyUserIds: hasAssignees ? params.assigneeIds : undefined,
    },
  );
}

export async function notifyTaskStatusChanged(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  status: TaskStatus;
}) {
  const locale = await getRequestLocale();

  await createNotificationsForTeam(
    {
      type: "task_status",
      title: translateNotificationEmit(locale, "taskStatusChanged.title"),
      author_name: params.actorName,
      message: `${params.taskTitle} — ${translateTaskStatusForNotification(locale, params.status)}`,
    },
    { excludeUserId: params.actorId },
  );
}

export async function notifyTaskCompleted(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  creatorUserId: string;
}) {
  if (params.creatorUserId === params.actorId) return;

  const locale = await getRequestLocale();

  await createNotificationsForTeam(
    {
      type: "task_completed",
      title: translateNotificationEmit(locale, "taskCompleted.title"),
      author_name: params.actorName,
      message: params.taskTitle,
    },
    {
      excludeUserId: params.actorId,
      onlyUserIds: [params.creatorUserId],
    },
  );
}

export async function notifyTaskPendingApproval(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  creatorUserId: string;
}) {
  if (params.creatorUserId === params.actorId) return;

  const locale = await getRequestLocale();

  await createNotificationsForTeam(
    {
      type: "task_pending_approval",
      title: translateNotificationEmit(locale, "taskPendingApproval.title"),
      author_name: params.actorName,
      message: params.taskTitle,
    },
    {
      excludeUserId: params.actorId,
      onlyUserIds: [params.creatorUserId],
    },
  );
}

export async function notifyTaskRevisionRequested(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  comment: string;
  assigneeIds: string[];
}) {
  const locale = await getRequestLocale();
  const preview =
    params.comment.length > 160
      ? `${params.comment.slice(0, 160)}…`
      : params.comment;

  await createNotificationsForTeam(
    {
      type: "task_revision",
      title: translateNotificationEmit(locale, "taskRevisionRequested.title"),
      author_name: params.actorName,
      message: `${params.taskTitle} — ${preview}`,
    },
    {
      excludeUserId: params.actorId,
      onlyUserIds: params.assigneeIds.length ? params.assigneeIds : undefined,
    },
  );
}

export async function notifyTaskApproved(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  assigneeIds: string[];
}) {
  const locale = await getRequestLocale();

  await createNotificationsForTeam(
    {
      type: "task_completed",
      title: translateNotificationEmit(locale, "taskApproved.title"),
      author_name: params.actorName,
      message: params.taskTitle,
    },
    {
      excludeUserId: params.actorId,
      onlyUserIds: params.assigneeIds.length ? params.assigneeIds : undefined,
    },
  );
}

export async function notifyTaskStatusUpdate(params: {
  actorId: string;
  actorName: string;
  taskTitle: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  creatorUserId: string;
  assigneeIds: string[];
  revisionComment?: string | null;
}) {
  if (params.newStatus === params.previousStatus) return;

  if (params.newStatus === "pending_approval") {
    await notifyTaskPendingApproval({
      actorId: params.actorId,
      actorName: params.actorName,
      taskTitle: params.taskTitle,
      creatorUserId: params.creatorUserId,
    });
    return;
  }

  if (params.newStatus === "needs_revision") {
    await notifyTaskRevisionRequested({
      actorId: params.actorId,
      actorName: params.actorName,
      taskTitle: params.taskTitle,
      comment: params.revisionComment ?? "",
      assigneeIds: params.assigneeIds,
    });
    return;
  }

  if (
    params.newStatus === "completed" &&
    params.previousStatus === "pending_approval"
  ) {
    await notifyTaskApproved({
      actorId: params.actorId,
      actorName: params.actorName,
      taskTitle: params.taskTitle,
      assigneeIds: params.assigneeIds,
    });
    return;
  }

  if (params.newStatus === "completed") {
    await notifyTaskCompleted({
      actorId: params.actorId,
      actorName: params.actorName,
      taskTitle: params.taskTitle,
      creatorUserId: params.creatorUserId,
    });
    return;
  }

  await notifyTaskStatusChanged({
    actorId: params.actorId,
    actorName: params.actorName,
    taskTitle: params.taskTitle,
    status: params.newStatus,
  });
}

export async function notifyNewClient(params: {
  clientName: string;
  source?: string;
}) {
  const locale = await getRequestLocale();

  await createNotificationsForTeam({
    type: "client_new",
    title: translateNotificationEmit(locale, "newClient.title"),
    author_name: null,
    message: params.source
      ? `${params.clientName} (${params.source})`
      : params.clientName,
  });
}

export async function notifyConsultationAssigned(params: {
  clientName: string;
  managerName?: string;
  onlyUserIds?: string[];
}) {
  const locale = await getRequestLocale();

  await createNotificationsForTeam(
    {
      type: "consultation_assigned",
      title: translateNotificationEmit(locale, "consultationAssigned.title"),
      author_name: params.managerName ?? null,
      message: params.clientName,
    },
    { onlyUserIds: params.onlyUserIds },
  );
}

export async function notifySystem(params: {
  title: string;
  message: string;
  onlyUserIds?: string[];
}) {
  await createNotificationsForTeam(
    {
      type: "system",
      title: params.title,
      message: params.message,
    },
    { onlyUserIds: params.onlyUserIds },
  );
}

export async function notifyCalendarReminder(params: {
  event: CalendarEvent;
  offsetMinutes: ReminderOffsetMinutes;
  userId: string;
}): Promise<Notification> {
  const locale = await getRequestLocale();
  const content = buildCalendarReminderNotificationContent(
    params.event,
    params.offsetMinutes,
    locale,
  );

  return createNotificationForUser(params.userId, {
    type: "calendar_reminder",
    title: content.title,
    message: content.message,
    author_name: null,
  });
}

export function buildCalendarEventCreatedRecipientIds(
  event: CalendarEvent,
  activeUserIds: string[],
): string[] {
  const recipientIds = new Set(resolveReminderRecipientIds(event, activeUserIds));
  recipientIds.add(event.createdByUserId);
  if (event.ownerUserId) {
    recipientIds.add(event.ownerUserId);
  }
  return [...recipientIds];
}

export async function notifyCalendarEventCreated(params: {
  actorId: string;
  actorName: string;
  event: CalendarEvent;
}): Promise<void> {
  const activeUserIds = await listActiveCalendarUserIds();
  const recipientIds = buildCalendarEventCreatedRecipientIds(
    params.event,
    activeUserIds,
  );

  if (!recipientIds.length) {
    return;
  }

  const locale = await getRequestLocale();
  const content = buildCalendarEventCreatedNotificationContent(
    params.event,
    locale,
  );

  await createNotificationsForUserIds(recipientIds, {
    type: isVideoMeeting(params.event)
      ? "calendar_video_invite"
      : "calendar_reminder",
    title: content.title,
    message: content.message,
    author_name: params.actorName,
  });
}

export async function notifyVideoMeetingInvite(params: {
  actorId: string;
  actorName: string;
  event: CalendarEvent;
}): Promise<void> {
  await notifyCalendarEventCreated(params);
}

export function buildMeetingRecordingSavedRecipientIds(
  teamJoinerUserIds: string[],
  startedByUserId?: string | null,
): string[] {
  const ids = new Set(
    teamJoinerUserIds.filter(
      (userId) => Boolean(userId) && !userId.startsWith("guest-"),
    ),
  );
  if (startedByUserId && !startedByUserId.startsWith("guest-")) {
    ids.add(startedByUserId);
  }
  return [...ids];
}

export async function notifyMeetingRecordingSaved(params: {
  recording: {
    id: string;
    eventId: string;
    fileName: string | null;
    startedByUserId: string;
    startedByName: string;
  };
  meetingTitle?: string;
  listTeamJoiners?: (eventId: string) => Promise<string[]>;
  getEvent?: (eventId: string) => Promise<CalendarEvent | null>;
}): Promise<void> {
  const listTeamJoiners =
    params.listTeamJoiners ??
    (await import("@/lib/supabase/calendar-meeting-audit-repo"))
      .sbListDistinctTeamJoinerUserIds;
  const getEvent =
    params.getEvent ??
    (await import("@/lib/calendar/store")).getEvent;

  let joinerIds: string[] = [];
  try {
    joinerIds = await listTeamJoiners(params.recording.eventId);
  } catch (error) {
    console.error("[notifications] meeting recording joiners", error);
  }

  const recipientIds = buildMeetingRecordingSavedRecipientIds(
    joinerIds,
    params.recording.startedByUserId,
  );
  if (!recipientIds.length) {
    return;
  }

  let meetingTitle = params.meetingTitle?.trim() || "";
  if (!meetingTitle) {
    try {
      const event = await getEvent(params.recording.eventId);
      if (event) {
        const { resolveCalendarEventTitle } = await import(
          "@/lib/calendar/demo-event-title"
        );
        const locale = await getRequestLocale().catch(() => "en" as const);
        meetingTitle = resolveCalendarEventTitle(event.title, locale);
      }
    } catch (error) {
      console.error("[notifications] meeting recording event", error);
    }
  }
  if (!meetingTitle) {
    meetingTitle = "Meeting";
  }

  const locale = await getRequestLocale().catch(() => "en" as const);
  const fileName =
    params.recording.fileName?.trim() || `${meetingTitle}.mp4`;
  const title = translateNotificationEmit(
    locale,
    "meetingRecordingSaved.title",
  );
  const message = translateNotificationEmit(
    locale,
    "meetingRecordingSaved.message",
  )
    .replace("{fileName}", fileName)
    .replace("{meetingTitle}", meetingTitle);

  await createNotificationsForUserIds(recipientIds, {
    type: "meeting_recording_ready",
    title,
    message,
    author_name: params.recording.startedByName || null,
  });
}
