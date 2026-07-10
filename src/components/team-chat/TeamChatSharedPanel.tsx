"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { getIntlLocaleTag } from "@/i18n/format";
import type {
  TeamChatLinkItem,
  TeamChatMessage,
  TeamChatSharedMediaType,
} from "@/lib/team-chat/types";
import { ChatFileMessage } from "./ChatFileMessage";
import { ChatImageMessage } from "./ChatImageMessage";
import { VoiceMessageAudio } from "./VoiceMessageAudio";
import styles from "./TeamChatView.module.css";

const TAB_IDS: TeamChatSharedMediaType[] = ["image", "file", "links", "voice"];

function formatLocalizedTeamChatDateTime(iso: string, locale: AppLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const intlTag = getIntlLocaleTag(locale);
  const datePart = new Intl.DateTimeFormat(intlTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat(intlTag, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${datePart} • ${timePart}`;
}

type TeamChatSharedPanelProps = {
  activeTab: TeamChatSharedMediaType;
  onTabChange: (tab: TeamChatSharedMediaType) => void;
  onOpenMessage: (messageId: string) => void;
};

export function TeamChatSharedPanel({
  activeTab,
  onTabChange,
  onOpenMessage,
}: TeamChatSharedPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("teamChat");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [links, setLinks] = useState<TeamChatLinkItem[]>([]);

  const fetchShared = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/team-chat/media?type=${encodeURIComponent(activeTab)}&limit=80`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as
        | { type: "links"; links: TeamChatLinkItem[] }
        | { type: "image" | "file" | "voice"; messages: TeamChatMessage[] };

      if (data.type === "links") {
        setLinks(data.links);
        setMessages([]);
      } else {
        setMessages(data.messages);
        setLinks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchShared();
  }, [fetchShared]);

  return (
    <div className={styles.sharedPanel}>
      <div className={styles.sharedTabs}>
        {TAB_IDS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            className={
              activeTab === tabId
                ? styles.sharedTabActive
                : styles.sharedTab
            }
            onClick={() => onTabChange(tabId)}
          >
            {t(`shared.tabs.${tabId}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.sharedEmpty}>{t("shared.loading")}</p>
      ) : activeTab === "links" ? (
        links.length ? (
          <div className={styles.sharedLinks}>
            {links.map((link, index) => (
              <div
                key={`${link.message_id}-${link.url}-${index}`}
                className={styles.sharedLinkItem}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sharedLinkUrl}
                >
                  {link.url}
                </a>
                <div className={styles.sharedLinkMeta}>
                  <span>{link.user_name}</span>
                  <span>{formatLocalizedTeamChatDateTime(link.created_at, locale)}</span>
                </div>
                <button
                  type="button"
                  className={styles.sharedOpenMessageBtn}
                  onClick={() => onOpenMessage(link.message_id)}
                >
                  {t("shared.goToMessage")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.sharedEmpty}>{t("shared.emptyLinks")}</p>
        )
      ) : messages.length ? (
        <div
          className={
            activeTab === "image"
              ? styles.sharedMediaGrid
              : styles.sharedList
          }
        >
          {messages.map((message) => (
            <div key={message.id} className={styles.sharedItem}>
              {activeTab === "image" && message.image_url ? (
                <button
                  type="button"
                  className={styles.sharedImageBtn}
                  onClick={() => onOpenMessage(message.id)}
                >
                  <ChatImageMessage src={message.image_url} />
                </button>
              ) : null}
              {activeTab === "file" && message.file_url ? (
                <ChatFileMessage
                  src={message.file_url}
                  fileName={message.file_name ?? t("file.fallbackName")}
                  fileSize={message.file_size}
                  contentType={message.file_content_type}
                />
              ) : null}
              {activeTab === "voice" && message.audio_url ? (
                <VoiceMessageAudio
                  src={message.audio_url}
                  durationMs={message.audio_duration_ms}
                />
              ) : null}
              <div className={styles.sharedItemMeta}>
                <span>{message.user_name}</span>
                <span>
                  {formatLocalizedTeamChatDateTime(message.created_at, locale)}
                </span>
              </div>
              <button
                type="button"
                className={styles.sharedOpenMessageBtn}
                onClick={() => onOpenMessage(message.id)}
              >
                {t("shared.goToMessage")}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.sharedEmpty}>{t("shared.emptyCategory")}</p>
      )}
    </div>
  );
}
