"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { translateTeamChatSearchLabel } from "@/i18n/team-chat-messages";
import { resolveDemoMessageText } from "@/lib/team-chat/demo-message-text";
import type { TeamChatMessage } from "@/lib/team-chat/types";
import styles from "./TeamChatView.module.css";

type ChatReplyQuoteProps = {
  userName: string;
  messageType: TeamChatMessage["message_type"];
  preview: string;
  onClick?: () => void;
  compact?: boolean;
};

export function buildLocalizedMessagePreview(
  locale: AppLocale,
  message: TeamChatMessage,
): string {
  if (message.message_type === "voice") {
    return translateTeamChatSearchLabel(locale, "voice");
  }
  if (message.message_type === "image") {
    const caption = message.message_text.trim();
    return caption
      ? resolveDemoMessageText(locale, caption)
      : translateTeamChatSearchLabel(locale, "image");
  }
  if (message.message_type === "file") {
    const caption = message.message_text.trim();
    return caption
      ? resolveDemoMessageText(locale, caption)
      : message.file_name?.trim() || translateTeamChatSearchLabel(locale, "file");
  }
  return resolveDemoMessageText(
    locale,
    message.message_text.trim().slice(0, 240),
  );
}

export function ChatReplyQuote({
  userName,
  messageType,
  preview,
  onClick,
  compact = false,
}: ChatReplyQuoteProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("teamChat.messageTypes");
  const resolvedPreview = resolveDemoMessageText(locale, preview);

  const content = (
    <>
      <span className={styles.replyQuoteAuthor}>{userName}</span>
      <span className={styles.replyQuoteType}>{t(messageType)}</span>
      <span className={styles.replyQuoteText}>{resolvedPreview}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={
          compact ? styles.replyQuoteBtnCompact : styles.replyQuoteBtn
        }
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={compact ? styles.replyQuoteCompact : styles.replyQuote}>
      {content}
    </div>
  );
}

export function messageHasReply(message: TeamChatMessage): boolean {
  return Boolean(
    message.reply_to_message_id &&
      message.reply_to_user_name &&
      message.reply_to_message_type &&
      message.reply_to_preview,
  );
}

export function ChatMessageReply({
  message,
  onJumpToParent,
}: {
  message: TeamChatMessage;
  onJumpToParent?: (messageId: string) => void;
}) {
  if (
    !message.reply_to_message_id ||
    !message.reply_to_user_name ||
    !message.reply_to_message_type ||
    !message.reply_to_preview
  ) {
    return null;
  }

  return (
    <ChatReplyQuote
      userName={message.reply_to_user_name}
      messageType={message.reply_to_message_type}
      preview={message.reply_to_preview}
      onClick={
        onJumpToParent
          ? () => onJumpToParent(message.reply_to_message_id!)
          : undefined
      }
    />
  );
}
