import "server-only";

import { randomUUID } from "node:crypto";
import type { Notification } from "@/lib/notifications/types";
import { encodeCalendarReminderMessage } from "@/lib/notifications/calendar-reminder-copy";

const DEMO_NOTIFICATION_TEMPLATES: Array<{
  type: Notification["type"];
  titleEn: string;
  titleRu: string;
  messageEn: string;
  messageRu: string;
  author?: string;
  hoursAgo: number;
  isRead?: boolean;
}> = [
  {
    type: "calendar_reminder",
    titleEn: "Upcoming meeting in 1 hour",
    titleRu: "Встреча через 1 час",
    messageEn: "10:00 – 11:00 — Client Consultation",
    messageRu: "10:00 – 11:00 — Client Consultation",
    hoursAgo: 0.5,
  },
  {
    type: "calendar_video_invite",
    titleEn: "Internal video meeting starts soon",
    titleRu: "Внутренняя видеовстреча скоро начнётся",
    messageEn: "16:30 – 17:30 — Internal Video Meeting",
    messageRu: "16:30 – 17:30 — Internal Video Meeting",
    author: "Lucas Martin",
    hoursAgo: 1,
  },
  {
    type: "calendar_reminder",
    titleEn: "Deadline tomorrow",
    titleRu: "Дедлайн завтра",
    messageEn: "All day — Compliance Deadline Prep",
    messageRu: "All day — Compliance Deadline Prep",
    hoursAgo: 3,
  },
  {
    type: "client_new",
    titleEn: "Client uploaded new documents",
    titleRu: "Клиент загрузил новые документы",
    messageEn: "Anna Kowalski submitted 3 files for review.",
    messageRu: "Anna Kowalski submitted 3 files for review.",
    hoursAgo: 5,
  },
  {
    type: "calendar_reminder",
    titleEn: "Reminder: tomorrow",
    titleRu: "Напоминание: завтра",
    messageEn: "09:30 – 10:30 — CRM Review",
    messageRu: "09:30 – 10:30 — CRM Review",
    hoursAgo: 8,
    isRead: true,
  },
  {
    type: "calendar_video_invite",
    titleEn: "Video meeting invitation",
    titleRu: "Приглашение на видеовстречу",
    messageEn: "14:00 – 15:00 — Client Follow-up Call",
    messageRu: "14:00 – 15:00 — Client Follow-up Call",
    author: "Daniel Cooper",
    hoursAgo: 12,
    isRead: true,
  },
];

export function buildDemoNotificationsForUser(
  userId: string,
  locale: "en" | "ru" = "en",
): Notification[] {
  const now = Date.now();

  return DEMO_NOTIFICATION_TEMPLATES.map((template) => {
    const title = locale === "ru" ? template.titleRu : template.titleEn;
    const display = locale === "ru" ? template.messageRu : template.messageEn;
    const eventId = `demo-notif-${template.type}-${title.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`;

    return {
      id: randomUUID(),
      user_id: userId,
      type: template.type,
      title,
      message: encodeCalendarReminderMessage(display, eventId, {
        isVideoMeeting: template.type === "calendar_video_invite",
      }),
      author_name: template.author ?? null,
      is_read: template.isRead ?? false,
      created_at: new Date(
        now - template.hoursAgo * 60 * 60 * 1000,
      ).toISOString(),
    };
  });
}
