import type { AppLocale } from "./config";
import { translateMessage } from "./messages";

export const CLIENT_STATUS_KEYS = [
  "new",
  "in_progress",
  "consultation",
  "documents",
  "completed",
  "waiting",
  "on_hold",
  "unspecified",
] as const;

export type ClientStatusKey = (typeof CLIENT_STATUS_KEYS)[number];

const STATUS_ALIASES: Record<string, ClientStatusKey> = {
  новый: "new",
  new: "new",
  "в работе": "in_progress",
  "in progress": "in_progress",
  консультация: "consultation",
  consultation: "consultation",
  "подготовка документов": "documents",
  documents: "documents",
  завершён: "completed",
  завершен: "completed",
  completed: "completed",
  waiting: "waiting",
  ожидание: "waiting",
  "on hold": "on_hold",
  "на паузе": "on_hold",
  "—": "unspecified",
  "": "unspecified",
};

export function resolveClientStatusKey(
  status: string | undefined | null,
): ClientStatusKey | null {
  const trimmed = (status ?? "").trim();
  if (!trimmed || trimmed === "—") {
    return "unspecified";
  }
  return STATUS_ALIASES[trimmed.toLowerCase()] ?? null;
}

export function translateClientStatus(
  locale: AppLocale,
  status: string | undefined | null,
): string {
  const key = resolveClientStatusKey(status);
  if (!key) {
    return (status ?? "").trim() || translateMessage(locale, "statuses.client.unspecified");
  }
  return translateMessage(locale, `statuses.client.${key}`);
}

export function isClientStatus(
  status: string | undefined | null,
  expected: ClientStatusKey,
): boolean {
  return resolveClientStatusKey(status) === expected;
}
