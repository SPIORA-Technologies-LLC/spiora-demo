"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  PortalChatSession,
  PortalChatSummary,
  PortalChatTurn,
} from "@/lib/ai/client-portal-chat-types";
import styles from "./ClientPortalAssistant.module.css";

type ChatEntry = PortalChatTurn;

export function ClientPortalAssistant() {
  const t = useTranslations("clientPortal.assistant");
  const locale = useLocale();
  const [chats, setChats] = useState<PortalChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inflightRef = useRef(false);

  const persistChat = useCallback(
    async (chatId: string, messages: ChatEntry[]) => {
      await fetch(`/api/client/assistant/chats/${encodeURIComponent(chatId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
    },
    [],
  );

  const refreshChatList = useCallback(async () => {
    const res = await fetch("/api/client/assistant/chats");
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/client/login";
      return [];
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { chats: PortalChatSummary[] };
    setChats(json.chats);
    return json.chats;
  }, []);

  const openChat = useCallback(async (chatId: string) => {
    const res = await fetch(
      `/api/client/assistant/chats/${encodeURIComponent(chatId)}`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as { chat: PortalChatSession };
    setActiveChatId(json.chat.id);
    setHistory(json.chat.messages);
    setSources([]);
  }, []);

  const createChat = useCallback(async () => {
    const res = await fetch("/api/client/assistant/chats", { method: "POST" });
    if (!res.ok) return null;
    const json = (await res.json()) as { chat: PortalChatSession };
    setActiveChatId(json.chat.id);
    setHistory([]);
    setSources([]);
    await refreshChatList();
    return json.chat.id;
  }, [refreshChatList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refreshChatList();
        if (cancelled) return;
        if (list.length > 0) {
          await openChat(list[0].id);
        } else {
          await createChat();
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createChat, openChat, refreshChatList]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  async function deleteChat(chatId: string) {
    await fetch(`/api/client/assistant/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
    });
    const list = await refreshChatList();
    if (activeChatId === chatId) {
      if (list.length > 0) await openChat(list[0].id);
      else await createChat();
    }
  }

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || loading || inflightRef.current) return;

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createChat();
      if (!chatId) return;
    }

    const nextHistory: ChatEntry[] = [
      ...history,
      { role: "user", content: message },
    ];
    setHistory(nextHistory);
    setInput("");
    setLoading(true);
    setSources([]);
    inflightRef.current = true;

    try {
      const res = await fetch("/api/client/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        window.location.href = "/client/login";
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      let reply = "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            let event = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              if (line.startsWith("data:")) data += line.slice(5).trim();
            }
            if (!data) continue;
            if (event === "meta") {
              const meta = JSON.parse(data) as { sources?: string[] };
              setSources(meta.sources ?? []);
              continue;
            }
            if (event === "delta") {
              const payload = JSON.parse(data) as { content?: string };
              if (payload.content) {
                reply += payload.content;
                setLoading(false);
                setHistory([
                  ...nextHistory,
                  { role: "assistant", content: reply },
                ]);
              }
              continue;
            }
            if (event === "error") {
              const payload = JSON.parse(data) as { message?: string };
              reply = payload.message ?? t("errors.generic");
              setHistory([
                ...nextHistory,
                { role: "assistant", content: reply },
              ]);
            }
          }
        }
      } else {
        const json = (await res.json()) as {
          reply?: string;
          sources?: string[];
        };
        reply = json.reply ?? t("errors.generic");
        setSources(json.sources ?? []);
        setHistory([...nextHistory, { role: "assistant", content: reply }]);
      }

      if (!reply) {
        reply = t("errors.generic");
        setHistory([...nextHistory, { role: "assistant", content: reply }]);
      }

      const finalHistory: ChatEntry[] = [
        ...nextHistory,
        { role: "assistant", content: reply },
      ];
      await persistChat(chatId, finalHistory);
      await refreshChatList();
    } catch {
      const fallback = [
        ...nextHistory,
        { role: "assistant" as const, content: t("errors.generic") },
      ];
      setHistory(fallback);
      await persistChat(chatId, fallback);
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }

  return (
    <section className={styles.panel} lang={locale}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("title")}</h2>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className={styles.newChatBtn}
          onClick={() => void createChat()}
          disabled={loading || bootstrapping}
        >
          {t("newChat")}
        </button>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarLabel}>{t("history")}</p>
          <ul className={styles.chatList}>
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  className={
                    chat.id === activeChatId
                      ? styles.chatItemActive
                      : styles.chatItem
                  }
                  onClick={() => void openChat(chat.id)}
                >
                  <span className={styles.chatTitle}>
                    {chat.title === "New chat" || chat.title === "Новый чат"
                      ? t("untitled")
                      : chat.title}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={t("deleteChat")}
                  onClick={() => void deleteChat(chat.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className={styles.chatPane}>
          <div className={styles.messages} ref={listRef}>
            {bootstrapping ? (
              <p className={styles.empty}>{t("loading")}</p>
            ) : history.length === 0 ? (
              <p className={styles.empty}>{t("empty")}</p>
            ) : (
              history.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={
                    msg.role === "user" ? styles.msgUser : styles.msgAssistant
                  }
                >
                  {msg.role === "assistant" ? (
                    <div className={styles.markdown}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              ))
            )}
            {loading ? <p className={styles.thinking}>{t("thinking")}</p> : null}
          </div>

          {sources.length > 0 ? (
            <p className={styles.sources}>
              {t("sources")}: {sources.join(" · ")}
            </p>
          ) : null}

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <textarea
              className={styles.input}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("placeholder")}
              rows={2}
              disabled={loading || bootstrapping}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={loading || bootstrapping || !input.trim()}
            >
              {t("send")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
