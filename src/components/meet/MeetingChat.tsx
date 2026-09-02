"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useChat,
  useLocalParticipant,
  type ReceivedChatMessage,
} from "@livekit/components-react";
import barStyles from "./MeetingControlBar.module.css";
import styles from "./MeetingChat.module.css";

const MEETING_CHAT_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "👍",
  "👏",
  "🙏",
  "❤️",
  "🔥",
  "✅",
  "🎉",
  "👀",
  "🙌",
] as const;

const MAX_MESSAGE_LENGTH = 500;

type MeetingChatContextValue = {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  unreadCount: number;
  chatMessages: ReceivedChatMessage[];
  send: (message: string) => Promise<ReceivedChatMessage>;
  isSending: boolean;
};

const MeetingChatContext = createContext<MeetingChatContextValue | null>(null);

function formatChatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function senderName(message: ReceivedChatMessage): string {
  return message.from?.name?.trim() || message.from?.identity || "Участник";
}

export function MeetingChatProvider({
  children,
  participantsOpen,
  onOpenChat,
}: {
  children: ReactNode;
  participantsOpen: boolean;
  onOpenChat?: () => void;
}) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [chatOpen, setChatOpenState] = useState(false);
  const [readCount, setReadCount] = useState(0);

  const setChatOpen = useCallback(
    (open: boolean) => {
      setChatOpenState(open);
      if (open) {
        onOpenChat?.();
        setReadCount(chatMessages.length);
      }
    },
    [chatMessages.length, onOpenChat],
  );

  const toggleChat = useCallback(() => {
    setChatOpen(!chatOpen);
  }, [chatOpen, setChatOpen]);

  useEffect(() => {
    if (chatOpen) {
      setReadCount(chatMessages.length);
    }
  }, [chatMessages.length, chatOpen]);

  useEffect(() => {
    if (participantsOpen && chatOpen) {
      setChatOpenState(false);
    }
  }, [chatOpen, participantsOpen]);

  const unreadCount = chatOpen
    ? 0
    : chatMessages
        .slice(readCount)
        .filter(
          (message) => message.from?.identity !== localParticipant.identity,
        ).length;

  const value = useMemo(
    () => ({
      chatOpen,
      setChatOpen,
      toggleChat,
      unreadCount,
      chatMessages,
      send,
      isSending,
    }),
    [
      chatMessages,
      chatOpen,
      isSending,
      send,
      setChatOpen,
      toggleChat,
      unreadCount,
    ],
  );

  return (
    <MeetingChatContext.Provider value={value}>
      {children}
    </MeetingChatContext.Provider>
  );
}

function useMeetingChatContext(): MeetingChatContextValue {
  const context = useContext(MeetingChatContext);
  if (!context) {
    throw new Error("Meeting chat components require MeetingChatProvider");
  }
  return context;
}

export function MeetingChatPanel() {
  const { chatOpen, setChatOpen, chatMessages, send, isSending } =
    useMeetingChatContext();
  const { localParticipant } = useLocalParticipant();
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!chatOpen) {
      return;
    }
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
    inputRef.current?.focus();
  }, [chatMessages.length, chatOpen]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Максимум ${MAX_MESSAGE_LENGTH} символов`);
      return;
    }

    setError(null);
    try {
      await send(text);
      setDraft("");
      setEmojiOpen(false);
    } catch {
      setError("Не удалось отправить сообщение");
    }
  }

  if (!chatOpen) {
    return null;
  }

  return (
    <aside className={styles.panel} aria-label="Чат встречи">
      <header className={styles.header}>
        <h2 className={styles.title}>Чат встречи</h2>
        <button
          type="button"
          className={styles.close}
          aria-label="Закрыть чат"
          onClick={() => setChatOpen(false)}
        >
          ×
        </button>
      </header>

      <div className={styles.list} ref={listRef} role="log" aria-live="polite">
        {chatMessages.length === 0 ? (
          <p className={styles.empty}>
            Пока нет сообщений. Напишите первым — все участники увидят ответ.
          </p>
        ) : (
          chatMessages.map((message) => {
            const mine = message.from?.identity === localParticipant.identity;
            return (
              <article
                key={message.id}
                className={[styles.message, mine ? styles.messageMine : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.meta}>
                  <span className={styles.author}>
                    {mine ? "Вы" : senderName(message)}
                  </span>
                  <time dateTime={new Date(message.timestamp).toISOString()}>
                    {formatChatTime(message.timestamp)}
                  </time>
                </div>
                <p className={styles.body}>{message.message}</p>
              </article>
            );
          })
        )}
      </div>

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        {emojiOpen ? (
          <div className={styles.emojiRow} role="listbox" aria-label="Смайлики">
            {MEETING_CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.emojiButton}
                onClick={() => {
                  setDraft((value) => `${value}${emoji}`);
                  inputRef.current?.focus();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.inputRow}>
          <button
            type="button"
            className={[
              styles.emojiToggle,
              emojiOpen ? styles.emojiToggleActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Смайлики"
            aria-pressed={emojiOpen}
            title="Смайлики"
            onClick={() => setEmojiOpen((value) => !value)}
          >
            😊
          </button>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={draft}
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Сообщение участникам…"
            aria-label="Текст сообщения"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <button
            type="submit"
            className={styles.send}
            disabled={isSending || !draft.trim()}
            aria-label="Отправить"
            title="Отправить"
          >
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>
    </aside>
  );
}

export function MeetingChatToast() {
  const { chatOpen, setChatOpen, chatMessages } = useMeetingChatContext();
  const { localParticipant } = useLocalParticipant();
  const [toast, setToast] = useState<ReceivedChatMessage | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!primedRef.current) {
      for (const message of chatMessages) {
        seenIdsRef.current.add(message.id);
      }
      primedRef.current = true;
      return;
    }

    const newest = chatMessages[chatMessages.length - 1];
    if (!newest || seenIdsRef.current.has(newest.id)) {
      return;
    }
    seenIdsRef.current.add(newest.id);

    if (newest.from?.identity === localParticipant.identity || chatOpen) {
      return;
    }

    setToast(newest);
    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === newest.id ? null : current));
    }, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [chatMessages, chatOpen, localParticipant.identity]);

  useEffect(() => {
    if (chatOpen) {
      setToast(null);
    }
  }, [chatOpen]);

  if (!toast || chatOpen) {
    return null;
  }

  return (
    <button
      type="button"
      className={styles.toast}
      onClick={() => {
        setToast(null);
        setChatOpen(true);
      }}
      aria-label={`Сообщение от ${senderName(toast)}: открыть чат`}
    >
      <span className={styles.toastLabel}>Новое сообщение</span>
      <span className={styles.toastAuthor}>{senderName(toast)}</span>
      <span className={styles.toastBody}>{toast.message}</span>
      <span className={styles.toastHint}>Открыть чат</span>
    </button>
  );
}

export function MeetingChatToggle() {
  const { chatOpen, toggleChat, unreadCount } = useMeetingChatContext();

  return (
    <button
      type="button"
      className={`${barStyles.toggle} ${chatOpen ? barStyles.toggleActive : ""}`}
      aria-label="Чат встречи"
      aria-pressed={chatOpen}
      title="Чат встречи"
      onClick={toggleChat}
    >
      <i className="fa-solid fa-comments" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className={styles.badge}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
