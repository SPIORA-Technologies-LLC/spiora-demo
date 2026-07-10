import "server-only";

import { randomUUID } from "node:crypto";
import type { AppLocale } from "@/i18n/config";
import {
  getDemoNotificationType,
  translateDemoNotificationMessage,
  translateDemoNotificationTitle,
  type DemoNotificationTemplateKey,
} from "@/i18n/notification-emit-messages";
import type { Notification } from "@/lib/notifications/types";
import { encodeCalendarReminderMessage } from "@/lib/notifications/calendar-reminder-copy";
import { encodeDemoNavMessage } from "@/lib/notifications/notification-demo-nav";

const DEMO_NOTIFICATION_TEMPLATE_KEYS: Array<{
  key: DemoNotificationTemplateKey;
  hoursAgo: number;
  author?: string;
  isRead?: boolean;
  eventId?: string;
  isVideoMeeting?: boolean;
  demoHref?: string;
}> = [
  { key: "teamMeetingSoon", hoursAgo: 0.5, eventId: "demo-notif-team-meeting" },
  {
    key: "videoMeetingSoon",
    hoursAgo: 1,
    author: "Lucas Martin",
    eventId: "demo-notif-video-meeting",
    isVideoMeeting: true,
  },
  {
    key: "taskDeadlineTomorrow",
    hoursAgo: 2,
    demoHref: "/tasks",
  },
  {
    key: "sofiaDocument",
    hoursAgo: 3,
    demoHref: "/clients/DEMO-1002",
  },
  {
    key: "aiSummaryReady",
    hoursAgo: 4,
    demoHref: "/ai-workspace",
  },
  {
    key: "messageFromEmma",
    hoursAgo: 5,
    author: "Emma Wilson",
    demoHref: "/team-chat",
  },
  {
    key: "newClientApplication",
    hoursAgo: 6,
    demoHref: "/clients/DEMO-1004",
  },
  {
    key: "calendarReminderTomorrow",
    hoursAgo: 8,
    eventId: "demo-notif-calendar-tomorrow",
    isRead: true,
  },
  {
    key: "taskAssigned",
    hoursAgo: 10,
    author: "Daniel Cooper",
    demoHref: "/tasks",
    isRead: true,
  },
  {
    key: "consultationAssigned",
    hoursAgo: 12,
    author: "Emma Wilson",
    demoHref: "/clients/DEMO-1002",
  },
  {
    key: "teamChatMessage",
    hoursAgo: 14,
    author: "Olivia Bennett",
    demoHref: "/team-chat",
  },
  {
    key: "documentUploaded",
    hoursAgo: 16,
    demoHref: "/clients/DEMO-1003",
  },
];

export const DEMO_NOTIFICATION_COUNT = DEMO_NOTIFICATION_TEMPLATE_KEYS.length;

function buildDemoNotificationMessage(
  locale: AppLocale,
  template: (typeof DEMO_NOTIFICATION_TEMPLATE_KEYS)[number],
): string {
  const display = translateDemoNotificationMessage(locale, template.key);
  const type = getDemoNotificationType(template.key);

  if (type === "calendar_reminder" || type === "calendar_video_invite") {
    const eventId = template.eventId ?? `demo-notif-${template.key}`;
    return encodeCalendarReminderMessage(display, eventId, {
      isVideoMeeting: Boolean(template.isVideoMeeting),
    });
  }

  if (template.demoHref) {
    return encodeDemoNavMessage(display, template.demoHref);
  }

  return display;
}

export function buildDemoNotificationsForUser(
  userId: string,
  locale: AppLocale = "en",
): Notification[] {
  const now = Date.now();

  return DEMO_NOTIFICATION_TEMPLATE_KEYS.map((template) => ({
    id: randomUUID(),
    user_id: userId,
    type: getDemoNotificationType(template.key),
    title: translateDemoNotificationTitle(locale, template.key),
    message: buildDemoNotificationMessage(locale, template),
    author_name: template.author ?? null,
    is_read: template.isRead ?? false,
    created_at: new Date(
      now - template.hoursAgo * 60 * 60 * 1000,
    ).toISOString(),
  }));
}
