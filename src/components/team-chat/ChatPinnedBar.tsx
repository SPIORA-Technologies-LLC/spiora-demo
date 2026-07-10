"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import type { TeamChatMessage } from "@/lib/team-chat/types";
import { UiIcon } from "@/components/ui/UiIcon";
import { buildLocalizedMessagePreview } from "./ChatReplyQuote";
import styles from "./TeamChatView.module.css";

type ChatPinnedBarProps = {
  messages: TeamChatMessage[];
  onSelect: (messageId: string) => void;
  onUnpin: (message: TeamChatMessage) => void;
};

export function ChatPinnedBar({
  messages,
  onSelect,
  onUnpin,
}: ChatPinnedBarProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("teamChat.pinned");

  if (!messages.length) return null;

  return (
    <div className={styles.pinnedBar}>
      <div className={styles.pinnedBarHeader}>
        <UiIcon icon="thumbtack" className={styles.pinnedBarIcon} />
        <span>{t("title")}</span>
      </div>
      <div className={styles.pinnedList}>
        {messages.map((message) => (
          <div key={message.id} className={styles.pinnedItem}>
            <button
              type="button"
              className={styles.pinnedItemBtn}
              onClick={() => onSelect(message.id)}
            >
              <span className={styles.pinnedItemAuthor}>{message.user_name}</span>
              <span className={styles.pinnedItemPreview}>
                {buildLocalizedMessagePreview(locale, message)}
              </span>
            </button>
            <button
              type="button"
              className={styles.pinnedUnpinBtn}
              aria-label={t("unpinAria")}
              onClick={() => onUnpin(message)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
