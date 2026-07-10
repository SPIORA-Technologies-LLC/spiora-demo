import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };

type MessageTree = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function getNested(tree: MessageTree, keyPath: string): string | undefined {
  const parts = keyPath.split(".");
  let current: unknown = tree;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

function translate(locale: AppLocale, keyPath: string): string {
  const catalog =
    locale === "ru" ? deepMerge(enCatalog, ruCatalog) : enCatalog;
  return getNested(catalog as MessageTree, `aiWorkspace.${keyPath}`) ?? keyPath;
}

export function translateWorkspaceMessage(
  locale: AppLocale,
  keyPath: string,
): string {
  return translate(locale, keyPath);
}

export type WorkspaceSourceKey =
  | "knowledgeBase"
  | "crm"
  | "crmCount"
  | "tasks"
  | "calendar"
  | "documents"
  | "clientContext"
  | "formgrid"
  | "formgridCount"
  | "emigrantDesk"
  | "emigrantDeskCount"
  | "emigrantDrive"
  | "newClients";

export function translateWorkspaceSource(
  locale: AppLocale,
  key: WorkspaceSourceKey,
  count?: number,
): string {
  if (key === "crmCount" && typeof count === "number") {
    return translate(locale, "sources.crmCount").replace("{count}", String(count));
  }
  if (key === "formgridCount" && typeof count === "number") {
    return translate(locale, "sources.formgridCount").replace(
      "{count}",
      String(count),
    );
  }
  if (key === "emigrantDeskCount" && typeof count === "number") {
    return translate(locale, "sources.emigrantDeskCount").replace(
      "{count}",
      String(count),
    );
  }
  return translate(locale, `sources.${key}`);
}

export const UNTITLED_CHAT_SENTINEL = "__untitled__";

export function isUntitledChatTitle(title: string): boolean {
  return (
    title === UNTITLED_CHAT_SENTINEL ||
    title === "Новый чат" ||
    title === "New chat" ||
    title === "Untitled chat"
  );
}

export function getUntitledChatTitle(locale: AppLocale): string {
  return UNTITLED_CHAT_SENTINEL;
}

export function resolveChatTitleForDisplay(
  locale: AppLocale,
  title: string,
): string {
  if (isUntitledChatTitle(title)) {
    return translate(locale, "history.untitledChat");
  }
  return title;
}
