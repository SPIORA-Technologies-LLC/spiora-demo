"use client";

import { useTranslations } from "next-intl";
import styles from "./TeamChatView.module.css";

type ChatImageMessageProps = {
  src: string;
};

export function ChatImageMessage({ src }: ChatImageMessageProps) {
  const t = useTranslations("teamChat");

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.imageLink}
      title={t("titles.openImage")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={t("image.alt")} className={styles.chatImage} />
    </a>
  );
}
