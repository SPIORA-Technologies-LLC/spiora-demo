import type { AppLocale } from "./config";
import enCatalog from "./dictionaries/en.json" with { type: "json" };
import ruCatalog from "./dictionaries/ru.json" with { type: "json" };
import type { KbCategoryId } from "@/lib/knowledge-base/types";

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
  return getNested(catalog as MessageTree, `knowledgeBase.${keyPath}`) ?? keyPath;
}

export function translateKnowledgeBaseMessage(
  locale: AppLocale,
  keyPath: string,
): string {
  return translate(locale, keyPath);
}

export function translateKnowledgeBaseCategory(
  locale: AppLocale,
  categoryId: KbCategoryId,
): string {
  const keyMap: Record<KbCategoryId, string> = {
    "company-policies": "categories.companyPolicies",
    "client-workflow": "categories.clientWorkflow",
    "document-management": "categories.documentManagement",
    "team-onboarding": "categories.teamOnboarding",
    "ai-automation": "categories.aiAutomation",
  };
  return translate(locale, keyMap[categoryId]);
}

export function translateKnowledgeBaseTag(
  locale: AppLocale,
  tagKey: string,
): string {
  return translate(locale, `tags.${tagKey}`);
}

export function translateKnowledgeBaseAuthor(
  locale: AppLocale,
  authorId: string,
): string {
  return translate(locale, `authors.${authorId}`);
}

export function translateKnowledgeBaseArticle(
  locale: AppLocale,
  slug: string,
  field: "title" | "summary" | "content",
): string {
  return translate(locale, `articles.${slug}.${field}`);
}

export function translateKnowledgeBaseFileType(
  locale: AppLocale,
  type: string,
): string {
  return translate(locale, `fileTypes.${type}`);
}

export function translateKnowledgeBaseSource(
  locale: AppLocale,
  source: string,
): string {
  return translate(locale, `sources.${source}`);
}

export function countKnowledgeBaseLeafKeys(): number {
  const kb = (enCatalog as MessageTree).knowledgeBase;
  if (!isPlainObject(kb)) return 0;

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
  walk(kb);
  return count;
}
