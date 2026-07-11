import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };
import type { UserRole } from "@/lib/auth/types";

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
  return getNested(catalog as MessageTree, keyPath) ?? keyPath;
}

export function translateAdminMessage(
  locale: AppLocale,
  keyPath: string,
): string {
  return translate(locale, keyPath);
}

export function translateUserRole(
  locale: AppLocale,
  role: UserRole,
): string {
  return translate(locale, `roles.${role}`);
}

export function translateMemberStatus(
  locale: AppLocale,
  status: "active" | "inactive" | "invited" | "suspended",
): string {
  return translate(locale, `roles.status.${status}`);
}
