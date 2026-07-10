import type { AppLocale } from "@/i18n/config";
import {
  translateTeamChatMessageTypeLabel,
  translateTeamChatSearchLabel,
} from "@/i18n/team-chat-messages";
import { resolveDemoMessageText } from "./demo-message-text";
import type { TeamChatMessage, TeamChatMessageType } from "./types";

export function buildMessagePreview(
  message: TeamChatMessage,
  locale: AppLocale = "en",
): string {
  if (message.message_type === "voice") {
    return translateTeamChatSearchLabel(locale, "voice");
  }
  if (message.message_type === "image") {
    const caption = resolveDemoMessageText(
      locale,
      message.message_text.trim(),
    );
    return caption || translateTeamChatSearchLabel(locale, "image");
  }
  if (message.message_type === "file") {
    const caption = resolveDemoMessageText(
      locale,
      message.message_text.trim(),
    );
    return (
      caption ||
      message.file_name?.trim() ||
      translateTeamChatSearchLabel(locale, "file")
    );
  }
  return resolveDemoMessageText(locale, message.message_text.trim()).slice(
    0,
    240,
  );
}

export function messageTypeLabel(
  type: TeamChatMessageType,
  locale: AppLocale = "en",
): string {
  if (type === "text") {
    return translateTeamChatMessageTypeLabel(locale, "text");
  }
  if (type === "voice") {
    return translateTeamChatSearchLabel(locale, "voice");
  }
  if (type === "image") {
    return translateTeamChatSearchLabel(locale, "image");
  }
  if (type === "file") {
    return translateTeamChatSearchLabel(locale, "file");
  }
  return translateTeamChatMessageTypeLabel(locale, "text");
}
