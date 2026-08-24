import "server-only";

import { listTeamUsers } from "@/lib/auth/users";
import { resolveVideoMeetingReminderRecipientIds } from "@/lib/calendar/participants";
import type { CalendarEvent } from "@/lib/calendar/types";
import { isVideoMeeting } from "@/lib/calendar/meeting";
import type { ReminderOffsetMinutes } from "@/lib/calendar/constants";
import { getRequestLocale } from "@/i18n/api-messages";
import {
  translateNotificationEmit,
  translateTaskStatusForNotification,
  translateTeamChatPreview,
} from "@/i18n/notification-emit-messages";
import { getDeletedUserIds } from "@/lib/team/store";
import type { TaskStatus } from "@/lib/tasks/types";
import {
  buildCalendarReminderNotificationContent,
  buildVideoMeetingInviteNotificationContent,
} from "./calendar-reminder-copy";
import { createNotificationForUser, createNotificationsForTeam } from "./store";
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

export function buildVideoMeetingInviteNotificationOptions(recipientIds: string[]): {
  onlyUserIds: string[];
} {
  return {
    onlyUserIds: recipientIds,
  };
}

export async function notifyVideoMeetingInvite(params: {
  actorId: string;
  actorName: string;
  event: CalendarEvent;
}): Promise<void> {
  if (!isVideoMeeting(params.event)) {
    return;
  }

  const deleted = new Set(await getDeletedUserIds());
  const activeUserIds = listTeamUsers()
    .filter((user) => !deleted.has(user.id))
    .map((user) => user.id);

  const recipientIds = resolveVideoMeetingReminderRecipientIds(
    params.event,
    activeUserIds,
  );

  if (!recipientIds.length) {
    return;
  }

  const locale = await getRequestLocale();
  const content = buildVideoMeetingInviteNotificationContent(
    params.event,
    locale,
  );

  await createNotificationsForTeam(
    {
      type: "calendar_video_invite",
      title: content.title,
      message: content.message,
      author_name: params.actorName,
    },
    buildVideoMeetingInviteNotificationOptions(recipientIds),
  );
}
