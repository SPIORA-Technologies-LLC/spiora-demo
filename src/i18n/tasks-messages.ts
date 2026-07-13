import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };
import type { TaskPriority, TaskStatus } from "@/lib/tasks/types";

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
  return getNested(catalog as MessageTree, `tasks.${keyPath}`) ?? keyPath;
}

export function translateTasksMessage(
  locale: AppLocale,
  keyPath: string,
): string {
  return translate(locale, keyPath);
}

export function translateTasksStatus(
  locale: AppLocale,
  status: TaskStatus,
): string {
  return translate(locale, `statuses.${status}`);
}

export function translateTasksPriority(
  locale: AppLocale,
  priority: TaskPriority,
): string {
  return translate(locale, `priorities.${priority}`);
}

export function countTasksLeafKeys(): number {
  const tasks = (enCatalog as MessageTree).tasks;
  if (!isPlainObject(tasks)) return 0;
  let count = 0;
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      count += 1;
      return;
    }
    if (isPlainObject(node)) {
      for (const value of Object.values(node)) {
        walk(value);
      }
    }
  };
  walk(tasks);
  return count;
}
