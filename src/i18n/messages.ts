import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppLocale } from "./config";

type MessageTree = Record<string, unknown>;

const dictionariesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "dictionaries",
);

function readDictionary(filename: string): MessageTree {
  return JSON.parse(
    fs.readFileSync(path.join(dictionariesDir, filename), "utf8"),
  ) as MessageTree;
}

export const enCatalog = readDictionary("en.json");
export const ruCatalog = readDictionary("ru.json");

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
