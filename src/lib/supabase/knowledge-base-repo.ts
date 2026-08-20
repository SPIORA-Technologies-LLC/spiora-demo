import "server-only";

import type { AppLocale } from "@/i18n/config";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  articleMatchesQuery,
  buildKbCategorySummaries,
  buildKbTagSummaries,
  flattenKbTranslationRow,
  mapKbDetail,
  mapKbListItem,
  type KbArticleRow,
  type KbArticleWithTranslation,
  type KbJoinTranslation,
} from "@/lib/knowledge-base/map-articles";
import {
  resolveArchivedAtForUpsert,
  resolvePublishedAtForUpsert,
} from "@/lib/knowledge-base/knowledge-base-api";
import { rankKbArticlesForAi } from "@/lib/knowledge-base/kb-ai-retrieve";
import type {
  KbArticleDetail,
  KbCategoryId,
  KbEditorArticle,
  KbListingResponse,
  KbSearchParams,
  KbScope,
} from "@/lib/knowledge-base/types";

const ARTICLE_SELECT =
  "id, slug, scope, category_id, tag_keys, author_key, status, updated_at, published_at, archived_at, external_url";

type TranslationJoinRow = KbArticleRow & {
  knowledge_base_article_translations: KbJoinTranslation[];
};

function flattenRow(
  row: TranslationJoinRow,
  locale: AppLocale,
): KbArticleWithTranslation | null {
  return flattenKbTranslationRow(row, locale);
}

async function fetchArticles(
  locale: AppLocale,
  options: {
    scope: KbScope;
    includeDrafts?: boolean;
    statusFilter?: KbSearchParams["status"];
  },
): Promise<KbArticleWithTranslation[]> {
  let query = getSupabaseAdmin()
    .from("knowledge_base_articles")
    .select(`${ARTICLE_SELECT}, knowledge_base_article_translations ( locale, title, summary, content )`)
    .eq("scope", options.scope)
    .order("updated_at", { ascending: false });

  const statusFilter = options.statusFilter;
  if (statusFilter === "archived") {
    query = query.eq("status", "archived");
  } else if (statusFilter === "draft") {
    query = query.eq("status", "draft").is("archived_at", null);
  } else if (statusFilter === "published") {
    query = query.eq("status", "published").is("archived_at", null);
  } else if (statusFilter === "all") {
    query = query.is("archived_at", null);
  } else if (options.includeDrafts) {
    query = query.is("archived_at", null);
  } else {
    query = query.eq("status", "published").is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: KbArticleWithTranslation[] = [];
  for (const row of (data ?? []) as TranslationJoinRow[]) {
    const flat = flattenRow(row, locale);
    if (flat) rows.push(flat);
  }
  return rows;
}

export async function sbCountKnowledgeBaseArticles(
  scope?: KbScope,
): Promise<number> {
  let query = getSupabaseAdmin()
    .from("knowledge_base_articles")
    .select("id", { count: "exact", head: true });
  if (scope) {
    query = query.eq("scope", scope);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function sbListKnowledgeBase(
  locale: AppLocale,
  params: KbSearchParams,
  options: { includeDrafts?: boolean } = {},
): Promise<KbListingResponse> {
  const scope = params.scope ?? "corporate";
  const includeDrafts = options.includeDrafts ?? false;
  const rows = await fetchArticles(locale, {
    scope,
    includeDrafts,
    statusFilter: params.status,
  });
  const query = params.q?.trim() ?? "";
  const categoryFilter = params.category as KbCategoryId | undefined;
  const tagFilter = params.tag?.trim();

  let filtered = rows;
  if (categoryFilter) {
    filtered = filtered.filter((r) => r.category_id === categoryFilter);
  }
  if (tagFilter) {
    filtered = filtered.filter((r) => r.tag_keys.includes(tagFilter));
  }

  const articles = filtered
    .map((row) => {
      const item = mapKbListItem(row, locale);
      return articleMatchesQuery(item, row.content, query) ? item : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  let selectedArticle: KbArticleDetail | undefined;
  if (params.article) {
    const match = rows.find((r) => r.slug === params.article);
    if (match) selectedArticle = mapKbDetail(match, locale);
  }

  const baseRows: KbArticleRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    scope: r.scope,
    category_id: r.category_id,
    tag_keys: r.tag_keys,
    author_key: r.author_key,
    status: r.status,
    updated_at: r.updated_at,
    published_at: r.published_at,
    archived_at: r.archived_at,
    external_url: r.external_url ?? null,
  }));

  return {
    demo: true,
    source: "postgresql",
    uploadDisabled: false,
    readOnly: false,
    categories: buildKbCategorySummaries(baseRows, locale),
    tags: buildKbTagSummaries(baseRows, locale),
    articles,
    selectedArticle,
    searchQuery: params.q,
    categoryFilter,
    tagFilter,
    statusFilter: params.status,
    requestedLocale: locale,
    resolvedLocale: selectedArticle?.resolvedLocale ?? locale,
    fallbackUsed:
      selectedArticle?.fallbackUsed === true ||
      articles.some((a) => a.fallbackUsed === true),
  };
}

export async function sbGetKnowledgeBaseRecord(
  slug: string,
  scope?: KbScope,
): Promise<KbArticleRow | null> {
  let query = getSupabaseAdmin()
    .from("knowledge_base_articles")
    .select(ARTICLE_SELECT)
    .eq("slug", slug);
  if (scope) {
    query = query.eq("scope", scope);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as KbArticleRow | null) ?? null;
}

export async function sbGetKnowledgeBaseEditorArticle(
  slug: string,
  scope?: KbScope,
): Promise<KbEditorArticle | null> {
  const record = await sbGetKnowledgeBaseRecord(slug, scope);
  if (!record) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_article_translations")
    .select("locale, title, summary, content")
    .eq("article_id", record.id);

  if (error) throw error;

  const translations = { en: { title: "", summary: "", content: "" }, ru: { title: "", summary: "", content: "" } };
  for (const row of data ?? []) {
    const locale = row.locale as "en" | "ru";
    if (locale === "en" || locale === "ru") {
      translations[locale] = {
        title: row.title,
        summary: row.summary,
        content: row.content,
      };
    }
  }

  return {
    slug: record.slug,
    scope: record.scope,
    categoryId: record.category_id,
    tagKeys: record.tag_keys,
    authorKey: record.author_key,
    status: record.status,
    publishedAt: record.published_at,
    externalUrl: record.external_url ?? null,
    translations,
  };
}

export async function sbDuplicateKnowledgeBaseArticle(
  sourceSlug: string,
  newSlug: string,
  scope?: KbScope,
): Promise<KbArticleDetail> {
  const editor = await sbGetKnowledgeBaseEditorArticle(sourceSlug, scope);
  if (!editor) throw new Error("kb_source_not_found");

  const translations = (["en", "ru"] as const)
    .filter((locale) => editor.translations[locale].title.trim())
    .map((locale) => ({
      locale,
      ...editor.translations[locale],
    }));

  return sbUpsertKnowledgeBaseArticle({
    slug: newSlug,
    scope: editor.scope,
    categoryId: editor.categoryId,
    tagKeys: editor.tagKeys,
    authorKey: editor.authorKey,
    status: "draft",
    externalUrl: editor.externalUrl,
    translations,
  });
}

export async function sbGetKnowledgeBaseBySlug(
  slug: string,
  locale: AppLocale,
  scope?: KbScope,
): Promise<KbArticleDetail | null> {
  let query = getSupabaseAdmin()
    .from("knowledge_base_articles")
    .select(`${ARTICLE_SELECT}, knowledge_base_article_translations ( locale, title, summary, content )`)
    .eq("slug", slug);
  if (scope) {
    query = query.eq("scope", scope);
  }
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const flat = flattenRow(data as TranslationJoinRow, locale);
  return flat ? mapKbDetail(flat, locale) : null;
}

export async function sbGetKnowledgeBaseTextForAi(
  locale: AppLocale,
  userQuery: string,
  scope: KbScope = "corporate",
): Promise<string> {
  // Load published articles for this scope, then rank by query tokens (OR).
  // Strict AND-on-every-word search was dropping valid client-KB hits.
  const listing = await sbListKnowledgeBase(locale, { scope });
  const candidates = await Promise.all(
    listing.articles.map(async (article) => {
      const detail = await sbGetKnowledgeBaseBySlug(article.slug, locale, scope);
      return {
        slug: article.slug,
        title: article.title,
        categoryLabel: article.categoryLabel,
        summary: article.summary,
        content: detail?.content ?? "",
      };
    }),
  );
  const ranked = rankKbArticlesForAi(candidates, userQuery, 8);
  const header = translateKnowledgeBaseMessage(locale, "aiContextPostgresHeader");
  const basePath = scope === "client" ? "/client-knowledge-base" : "/knowledge-base";

  const resolved = ranked.map((article) => {
    const excerpt = (article.content || article.summary)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);
    return `--- ${article.title} (${article.categoryLabel})\n${excerpt}\nLink: ${basePath}?article=${article.slug}`;
  });

  if (resolved.length === 0) {
    return `${header}\n${translateKnowledgeBaseMessage(locale, "aiContextEmpty")}`;
  }
  return `${header}\n${resolved.join("\n\n")}`;
}

export type KbUpsertInput = {
  slug: string;
  scope: KbScope;
  categoryId: KbCategoryId;
  tagKeys: string[];
  authorKey: string;
  status: "draft" | "published" | "archived";
  externalUrl?: string | null;
  translations: Array<{
    locale: AppLocale;
    title: string;
    summary: string;
    content: string;
  }>;
};

export async function sbUpsertKnowledgeBaseArticle(
  input: KbUpsertInput,
  options: { existingPublishedAt?: string | null } = {},
): Promise<KbArticleDetail> {
  const now = new Date().toISOString();
  const publishedAt = resolvePublishedAtForUpsert(
    input.status,
    options.existingPublishedAt ?? null,
    now,
  );
  const archivedAt = resolveArchivedAtForUpsert(input.status, now);

  const articlePayload: Record<string, unknown> = {
    slug: input.slug,
    scope: input.scope,
    category_id: input.categoryId,
    tag_keys: input.tagKeys,
    author_key: input.authorKey,
    status: input.status,
    updated_at: now,
    published_at: publishedAt,
    archived_at: archivedAt,
    is_demo: true,
  };
  if (input.externalUrl !== undefined) {
    articlePayload.external_url = input.externalUrl;
  }

  const { data: article, error: articleError } = await getSupabaseAdmin()
    .from("knowledge_base_articles")
    .upsert(articlePayload, { onConflict: "slug" })
    .select(ARTICLE_SELECT)
    .single();

  if (articleError) throw articleError;

  for (const tr of input.translations) {
    const { error } = await getSupabaseAdmin()
      .from("knowledge_base_article_translations")
      .upsert(
        {
          article_id: article.id,
          locale: tr.locale,
          title: tr.title,
          summary: tr.summary,
          content: tr.content,
          updated_at: now,
        },
        { onConflict: "article_id,locale" },
      );
    if (error) throw error;
  }

  const detail = await sbGetKnowledgeBaseBySlug(input.slug, input.translations[0]?.locale ?? "en");
  if (!detail) throw new Error("kb_upsert_failed");
  return detail;
}

export async function sbArchiveKnowledgeBaseArticle(slug: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("knowledge_base_articles")
    .update({ status: "archived", archived_at: now, updated_at: now })
    .eq("slug", slug);
  if (error) throw error;
}
