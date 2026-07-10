import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };
import type { NotificationType } from "@/lib/notifications/types";
import type { TaskStatus } from "@/lib/tasks/types";

type MessageTree = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function getNested(tree: MessageTree, keyPath: string): string | undefined {
  const parts = keyPath.split(".");
  let current: unknown = tree;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

function translate(locale: AppLocale, keyPath: string): string {
  const catalog =
    locale === "ru" ? deepMerge(enCatalog, ruCatalog) : enCatalog;
  return (
    getNested(catalog as MessageTree, `notifications.emit.${keyPath}`) ??
    keyPath
  );
}

export function translateNotificationEmit(
  locale: AppLocale,
  keyPath: string,
): string {
  return translate(locale, keyPath);
}

export function translateTaskStatusForNotification(
  locale: AppLocale,
  status: TaskStatus,
): string {
  return translate(locale, `taskStatus.${status}`);
}

export function translateTeamChatPreview(
  locale: AppLocale,
  kind: "voice" | "image" | "file" | "imageWithCaption" | "fileWithCaption",
  caption?: string,
): string {
  if (kind === "voice") {
    return translate(locale, "teamChatPreview.voice");
  }
  if (kind === "image") {
    return caption
      ? translate(locale, "teamChatPreview.imageWithCaption").replace(
          "{caption}",
          caption,
        )
      : translate(locale, "teamChatPreview.image");
  }
  return caption
    ? translate(locale, "teamChatPreview.fileWithCaption").replace(
        "{caption}",
        caption,
      )
    : translate(locale, "teamChatPreview.file");
}

export type DemoNotificationTemplateKey =
  | "teamMeetingSoon"
  | "sofiaDocument"
  | "aiSummaryReady"
  | "messageFromEmma"
  | "taskDeadlineTomorrow"
  | "videoMeetingSoon"
  | "newClientApplication"
  | "calendarReminderTomorrow"
  | "taskAssigned"
  | "consultationAssigned"
  | "teamChatMessage"
  | "documentUploaded";

export function translateDemoNotificationTitle(
  locale: AppLocale,
  key: DemoNotificationTemplateKey,
): string {
  return translate(locale, `demo.${key}.title`);
}

export function translateDemoNotificationMessage(
  locale: AppLocale,
  key: DemoNotificationTemplateKey,
): string {
  return translate(locale, `demo.${key}.message`);
}

export function getDemoNotificationType(
  key: DemoNotificationTemplateKey,
): NotificationType {
  switch (key) {
    case "teamMeetingSoon":
    case "calendarReminderTomorrow":
      return "calendar_reminder";
    case "videoMeetingSoon":
      return "calendar_video_invite";
    case "sofiaDocument":
    case "newClientApplication":
    case "documentUploaded":
      return "client_new";
    case "messageFromEmma":
    case "teamChatMessage":
      return "team_chat";
    case "taskDeadlineTomorrow":
    case "taskAssigned":
      return "task_new";
    case "consultationAssigned":
      return "consultation_assigned";
    case "aiSummaryReady":
      return "system";
    default:
      return "system";
  }
}
