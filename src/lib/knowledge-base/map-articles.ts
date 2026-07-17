import type { AppLocale } from "@/i18n/config";
import {
  translateKnowledgeBaseAuthor,
  translateKnowledgeBaseCategory,
  translateKnowledgeBaseTag,
} from "@/i18n/knowledge-base-messages";
import type {
  KbArticleDetail,
  KbArticleListItem,
  KbCategoryId,
  KbCategorySummary,
  KbTagSummary,
} from "./types";

export type KbArticleRow = {
  id: string;
  slug: string;
  category_id: KbCategoryId;
  tag_keys: string[];
  author_key: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
};

export type KbTranslationRow = {
  article_id: string;
  locale: AppLocale;
  title: string;
  summary: string;
  content: string;
};

export type KbArticleWithTranslation = KbArticleRow & KbTranslationRow;

function formatArticleDate(iso: string, locale: AppLocale): string {
  const intlTag = locale === "ru" ? "ru-RU" : "en-US";
  return new Date(iso).toLocaleDateString(intlTag, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function mapKbListItem(
  row: KbArticleWithTranslation,
  locale: AppLocale,
): KbArticleListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    categoryId: row.category_id,
    categoryLabel: translateKnowledgeBaseCategory(locale, row.category_id),
    tags: row.tag_keys,
    tagLabels: row.tag_keys.map((tag) => translateKnowledgeBaseTag(locale, tag)),
    authorName: translateKnowledgeBaseAuthor(locale, row.author_key),
    updatedAt: formatArticleDate(row.updated_at, locale),
    status: row.status,
  };
}

export function mapKbDetail(
  row: KbArticleWithTranslation,
  locale: AppLocale,
): KbArticleDetail {
  return {
    ...mapKbListItem(row, locale),
    content: row.content,
  };
}

export function buildKbCategorySummaries(
  rows: KbArticleRow[],
  locale: AppLocale,
): KbCategorySummary[] {
  const counts = new Map<KbCategoryId, number>();
  for (const row of rows) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: translateKnowledgeBaseCategory(locale, id),
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function buildKbTagSummaries(
  rows: KbArticleRow[],
  locale: AppLocale,
): KbTagSummary[] {
  const tagSet = new Set<string>();
  for (const row of rows) {
    for (const tag of row.tag_keys) tagSet.add(tag);
  }
  return [...tagSet]
    .map((id) => ({ id, label: translateKnowledgeBaseTag(locale, id) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function articleMatchesQuery(
  item: KbArticleListItem,
  content: string,
  query: string,
): boolean {
  if (!query.trim()) return true;
  const haystack = [
    item.title,
    item.summary,
    item.categoryLabel,
    ...item.tagLabels,
    content,
  ]
    .join(" ")
    .toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
