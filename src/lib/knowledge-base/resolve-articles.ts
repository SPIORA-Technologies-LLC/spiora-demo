import type { AppLocale } from "@/i18n/config";
import {
  translateKnowledgeBaseArticle,
  translateKnowledgeBaseAuthor,
  translateKnowledgeBaseCategory,
  translateKnowledgeBaseMessage,
  translateKnowledgeBaseTag,
} from "@/i18n/knowledge-base-messages";
import type {
  KbArticleDetail,
  KbArticleListItem,
  KbArticleRecord,
  KbCategoryId,
  KbCategorySummary,
  KbListingResponse,
  KbSearchParams,
  KbTagSummary,
} from "./types";

function formatArticleDate(iso: string, locale: AppLocale): string {
  const intlTag = locale === "ru" ? "ru-RU" : "en-US";
  return new Date(iso).toLocaleDateString(intlTag, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function resolveArticleListItem(
  record: KbArticleRecord,
  locale: AppLocale,
): KbArticleListItem {
  return {
    id: record.id,
    slug: record.slug,
    title: translateKnowledgeBaseArticle(locale, record.slug, "title"),
    summary: translateKnowledgeBaseArticle(locale, record.slug, "summary"),
    categoryId: record.categoryId,
    categoryLabel: translateKnowledgeBaseCategory(locale, record.categoryId),
    tags: record.tagKeys,
    tagLabels: record.tagKeys.map((tag) =>
      translateKnowledgeBaseTag(locale, tag),
    ),
    authorName: translateKnowledgeBaseAuthor(locale, record.authorId),
    updatedAt: formatArticleDate(record.updatedAt, locale),
  };
}

export function resolveArticleDetail(
  record: KbArticleRecord,
  locale: AppLocale,
): KbArticleDetail {
  return {
    ...resolveArticleListItem(record, locale),
    content: translateKnowledgeBaseArticle(locale, record.slug, "content"),
  };
}

function normalizeSearchQuery(q: string | undefined): string {
  return q?.trim().toLowerCase() ?? "";
}

function articleMatchesSearch(
  item: KbArticleListItem,
  query: string,
  content: string,
): boolean {
  if (!query) return true;
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
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function buildCategorySummaries(
  records: KbArticleRecord[],
  locale: AppLocale,
): KbCategorySummary[] {
  const counts = new Map<KbCategoryId, number>();
  for (const record of records) {
    counts.set(record.categoryId, (counts.get(record.categoryId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: translateKnowledgeBaseCategory(locale, id),
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function buildTagSummaries(
  records: KbArticleRecord[],
  locale: AppLocale,
): KbTagSummary[] {
  const tagSet = new Set<string>();
  for (const record of records) {
    for (const tag of record.tagKeys) {
      tagSet.add(tag);
    }
  }
  return [...tagSet]
    .map((id) => ({
      id,
      label: translateKnowledgeBaseTag(locale, id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function searchDemoArticles(
  records: KbArticleRecord[],
  locale: AppLocale,
  params: KbSearchParams,
): KbListingResponse {
  const query = normalizeSearchQuery(params.q);
  const categoryFilter = params.category as KbCategoryId | undefined;
  const tagFilter = params.tag?.trim();

  let filtered = records;
  if (categoryFilter) {
    filtered = filtered.filter((r) => r.categoryId === categoryFilter);
  }
  if (tagFilter) {
    filtered = filtered.filter((r) => r.tagKeys.includes(tagFilter));
  }

  const articles: KbArticleListItem[] = [];
  const contentBySlug = new Map<string, string>();

  for (const record of filtered) {
    const content = translateKnowledgeBaseArticle(locale, record.slug, "content");
    contentBySlug.set(record.slug, content);
    const item = resolveArticleListItem(record, locale);
    if (articleMatchesSearch(item, query, content)) {
      articles.push(item);
    }
  }

  articles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt, locale));

  let selectedArticle: KbArticleDetail | undefined;
  if (params.article) {
    const record = records.find((r) => r.slug === params.article);
    if (record) {
      selectedArticle = resolveArticleDetail(record, locale);
    }
  }

  return {
    demo: true,
    source: "demo",
    uploadDisabled: true,
    readOnly: true,
    categories: buildCategorySummaries(records, locale),
    tags: buildTagSummaries(records, locale),
    articles,
    selectedArticle,
    searchQuery: params.q,
    categoryFilter,
    tagFilter,
  };
}

export function buildDemoAiKnowledgeBaseText(
  records: KbArticleRecord[],
  locale: AppLocale,
  userQuery: string,
): string {
  const listing = searchDemoArticles(records, locale, { q: userQuery });
  const header = translateKnowledgeBaseMessage(locale, "aiContextHeader");
  const lines = listing.articles.slice(0, 8).map((article) => {
    const content =
      records.find((r) => r.slug === article.slug) &&
      translateKnowledgeBaseArticle(locale, article.slug, "content");
    const excerpt = content
      ? content.replace(/\s+/g, " ").trim().slice(0, 600)
      : article.summary;
    return `--- ${article.title} (${article.categoryLabel})\n${excerpt}\nLink: /knowledge-base?article=${article.slug}`;
  });

  if (lines.length === 0) {
    return `${header}\n${translateKnowledgeBaseMessage(locale, "aiContextEmpty")}`;
  }

  return `${header}\n${lines.join("\n\n")}`;
}
