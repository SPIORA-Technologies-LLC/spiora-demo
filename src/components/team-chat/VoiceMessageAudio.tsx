"use client";

import { useTranslations } from "next-intl";
import { formatVoiceDuration } from "@/lib/team-chat/format";
import { UiIcon } from "@/components/ui/UiIcon";
import styles from "./TeamChatView.module.css";

type VoiceMessageAudioProps = {
  src: string;
  durationMs: number | null;
};

export function VoiceMessageAudio({ src, durationMs }: VoiceMessageAudioProps) {
  const t = useTranslations("teamChat.voice");

  return (
    <div className={styles.voiceMessage}>
      <span className={styles.voiceIcon} aria-hidden>
        <UiIcon icon="microphone" className={styles.voiceIconGlyph} />
      </span>
      <audio className={styles.voicePlayer} controls preload="metadata" src={src}>
        {t("unsupportedPlayback")}
      </audio>
      {durationMs != null ? (
        <span className={styles.voiceDuration}>
          {formatVoiceDuration(durationMs)}
        </span>
      ) : null}
    </div>
  );
}
