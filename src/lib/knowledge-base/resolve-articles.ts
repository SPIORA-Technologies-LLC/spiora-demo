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
import { alignKbTextToLocale } from "./kb-text-locale";
import { rankKbArticlesForAi } from "./kb-ai-retrieve";

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
  const raw = {
    title: translateKnowledgeBaseArticle(locale, record.slug, "title"),
    summary: translateKnowledgeBaseArticle(locale, record.slug, "summary"),
    content: "",
  };
  const aligned = alignKbTextToLocale(locale, raw);
  return {
    id: record.id,
    slug: record.slug,
    title: aligned.title,
    summary: aligned.summary,
    categoryId: record.categoryId,
    categoryLabel: translateKnowledgeBaseCategory(locale, record.categoryId),
    tags: record.tagKeys,
    tagLabels: record.tagKeys.map((tag) =>
      translateKnowledgeBaseTag(locale, tag),
    ),
    authorName: translateKnowledgeBaseAuthor(locale, record.authorId),
    updatedAt: formatArticleDate(record.updatedAt, locale),
    requestedLocale: locale,
    resolvedLocale: locale,
    fallbackUsed: aligned.corrected,
  };
}

export function resolveArticleDetail(
  record: KbArticleRecord,
  locale: AppLocale,
): KbArticleDetail {
  const list = resolveArticleListItem(record, locale);
  const contentAligned = alignKbTextToLocale(locale, {
    title: list.title,
    summary: list.summary,
    content: translateKnowledgeBaseArticle(locale, record.slug, "content"),
  });
  return {
    ...list,
    content: contentAligned.content,
    fallbackUsed: list.fallbackUsed || contentAligned.corrected,
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
    requestedLocale: locale,
    resolvedLocale: selectedArticle?.resolvedLocale ?? locale,
    fallbackUsed: false,
  };
}

export function buildDemoAiKnowledgeBaseText(
  records: KbArticleRecord[],
  locale: AppLocale,
  userQuery: string,
): string {
  const candidates = records.map((record) => {
    const item = resolveArticleListItem(record, locale);
    return {
      slug: record.slug,
      title: item.title,
      categoryLabel: item.categoryLabel,
      summary: item.summary,
      content: translateKnowledgeBaseArticle(locale, record.slug, "content"),
    };
  });
  const ranked = rankKbArticlesForAi(candidates, userQuery, 8);
  const header = translateKnowledgeBaseMessage(locale, "aiContextHeader");
  const lines = ranked.map((article) => {
    const excerpt = (article.content || article.summary)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);
    return `--- ${article.title} (${article.categoryLabel})\n${excerpt}\nLink: /knowledge-base?article=${article.slug}`;
  });

  if (lines.length === 0) {
    return `${header}\n${translateKnowledgeBaseMessage(locale, "aiContextEmpty")}`;
  }

  return `${header}\n${lines.join("\n\n")}`;
}
