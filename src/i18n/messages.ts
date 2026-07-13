import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };

type MessageTree = Record<string, unknown>;

const catalogs: Record<AppLocale, MessageTree> = {
  en: enCatalog,
  ru: ruCatalog,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMergeMessages(
  base: MessageTree,
  override: MessageTree,
): MessageTree {
  const result: MessageTree = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMergeMessages(current, value);
      continue;
    }
    result[key] = value;
  }

  return result;
}

export function getMessagesForLocale(locale: AppLocale): MessageTree {
  if (locale === "en") {
    return enCatalog;
  }
  return deepMergeMessages(enCatalog, ruCatalog);
}

export function getNestedMessage(
  tree: MessageTree,
  keyPath: string,
): string | undefined {
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

export function translateMessage(
  locale: AppLocale,
  keyPath: string,
): string {
  const localized = getNestedMessage(getMessagesForLocale(locale), keyPath);
  if (localized) {
    return localized;
  }
  return getNestedMessage(enCatalog, keyPath) ?? keyPath;
}

export function getMessageFallback(keyPath: string): string {
  return getNestedMessage(enCatalog, keyPath) ?? keyPath;
}
