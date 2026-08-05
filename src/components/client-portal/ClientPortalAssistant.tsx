"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PortalChatTurn } from "@/lib/ai/client-portal-chat-types";
import styles from "./ClientPortalAssistant.module.css";

type ChatEntry = PortalChatTurn;

export function ClientPortalAssistant() {
  const t = useTranslations("clientPortal.assistant");
  const locale = useLocale();
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || loading || inflightRef.current) return;

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
    } catch {
      setHistory([
        ...nextHistory,
        { role: "assistant", content: t("errors.generic") },
      ]);
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }

  return (
    <section className={styles.panel} lang={locale}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("title")}</h2>
      </div>

      <aside className={styles.aiNotice} role="note" aria-label={t("aiNotice.title")}>
        <span className={styles.aiNoticeBadge}>{t("aiNotice.badge")}</span>
        <div className={styles.aiNoticeCopy}>
          <p className={styles.aiNoticeTitle}>{t("aiNotice.title")}</p>
          <p className={styles.aiNoticeText}>{t("aiNotice.text")}</p>
        </div>
      </aside>

      <div className={styles.body}>
        <div className={styles.chatPane}>
          <div className={styles.messages} ref={listRef}>
            {history.length === 0 ? (
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
              rows={1}
              disabled={loading}
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
              disabled={loading || !input.trim()}
            >
              {t("send")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
