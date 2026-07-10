"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import styles from "./ClientAiPanel.module.css";

const PRESET_KEYS = [
  "summary",
  "documentsNeeded",
  "clientMessage",
  "followUp",
  "risks",
  "bestProgram",
  "compareCountries",
  "proposal",
  "managerReport",
] as const;

type PresetKey = (typeof PRESET_KEYS)[number];

type PanelState = {
  open: boolean;
  mode: "chat" | "summary";
};

type ClientAiPanelProps = {
  clientId: string;
  clientName: string;
  state: PanelState;
  onClose: () => void;
};

export function ClientAiPanel({
  clientId,
  clientName,
  state,
  onClose,
}: ClientAiPanelProps) {
  const t = useTranslations("clients.ai");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendAi(
    userMessage: string,
    mode: "chat" | "summary" = "chat",
  ) {
    setLoading(true);
    setReply("");
    try {
      const res = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, mode }),
        },
      );
      const data = (await res.json()) as { reply?: string; error?: string };
      setReply(data.reply ?? data.error ?? t("errorReply"));
    } catch {
      setReply(t("errorConnection"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (state.open && state.mode === "summary") {
      void sendAi("", "summary");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.mode, clientId]);

  if (!state.open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <Card className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>
              {state.mode === "summary" ? t("titleSummary") : t("titleChat")}
            </h2>
            <p className={styles.subtitle}>
              {t("context", { name: clientName })}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t("closeAria")}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className={styles.presets}>
          {PRESET_KEYS.map((presetKey) => (
            <button
              key={presetKey}
              type="button"
              className={styles.preset}
              disabled={loading}
              onClick={() => {
                const preset = t(`presets.${presetKey}` as `presets.${PresetKey}`);
                setMessage(preset);
                void sendAi(preset, "chat");
              }}
            >
              {t(`presets.${presetKey}` as `presets.${PresetKey}`)}
            </button>
          ))}
        </div>

        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.input}
            placeholder={t("inputPlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) void sendAi(message, "chat");
            }}
          />
          <Button
            type="button"
            disabled={loading || !message.trim()}
            onClick={() => void sendAi(message, "chat")}
          >
            {loading ? "…" : t("send")}
          </Button>
        </div>

        <div className={styles.reply}>
          {loading ? (
            <p className={styles.loading}>{t("loading")}</p>
          ) : reply ? (
            <pre className={styles.replyText}>{reply}</pre>
          ) : (
            <p className={styles.hint}>{t("hint")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}

export function ClientAiActions({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const t = useTranslations("clients.ai");
  const [panel, setPanel] = useState<PanelState>({ open: false, mode: "chat" });

  return (
    <>
      <div className={styles.triggers}>
        <Button
          type="button"
          onClick={() => setPanel({ open: true, mode: "chat" })}
        >
          🤖 {t("askButton")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPanel({ open: true, mode: "summary" })}
        >
          📋 {t("summaryButton")}
        </Button>
      </div>
      <ClientAiPanel
        clientId={clientId}
        clientName={clientName}
        state={panel}
        onClose={() => setPanel({ ...panel, open: false })}
      />
    </>
  );
}
