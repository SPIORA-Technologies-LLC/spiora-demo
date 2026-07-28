import type { AppLocale } from "@/i18n/config";

export type KbCategoryId =
  | "company-policies"
  | "client-workflow"
  | "document-management"
  | "team-onboarding"
  | "ai-automation";

export type KbScope = "corporate" | "client";

export type KbArticleSeed = {
  slug: string;
  categoryId: KbCategoryId;
  tagKeys: string[];
  authorId: string;
  updatedAt: string;
};

export type KbArticleRecord = KbArticleSeed & {
  id: string;
  createdAt: string;
  scope: KbScope;
};

export type KbArticleStatus = "draft" | "published" | "archived";

export type KbArticleListItem = {
  id: string;
  slug: string;
  scope?: KbScope;
  title: string;
  summary: string;
  categoryId: KbCategoryId;
  categoryLabel: string;
  tags: string[];
  tagLabels: string[];
  authorName: string;
  updatedAt: string;
  status?: KbArticleStatus;
  /** External http(s) URL when this material is a link. */
  externalUrl?: string | null;
  requestedLocale?: AppLocale;
  resolvedLocale?: AppLocale;
  fallbackUsed?: boolean;
};

export type KbArticleDetail = KbArticleListItem & {
  content: string;
  scope?: KbScope;
};

export type KbCategorySummary = {
  id: KbCategoryId;
  label: string;
  count: number;
};

export type KbTagSummary = {
  id: string;
  label: string;
};

export type KbSource =
  | "demo"
  | "embedded"
  | "postgresql"
  | "google_drive"
  | "unconfigured"
  | "error";

export type KbListingResponse = {
  demo: boolean;
  source: KbSource;
  uploadDisabled: boolean;
  readOnly: boolean;
  /** Owner can create/edit via UI when PostgreSQL KB is enabled. */
  canManage?: boolean;
  categories: KbCategorySummary[];
  tags: KbTagSummary[];
  articles: KbArticleListItem[];
  selectedArticle?: KbArticleDetail;
  searchQuery?: string;
  categoryFilter?: KbCategoryId;
  tagFilter?: string;
  statusFilter?: KbArticleStatus | "all";
  errorMessage?: string;
  requestedLocale?: AppLocale;
  resolvedLocale?: AppLocale;
  fallbackUsed?: boolean;
};

export type KbEditorTranslation = {
  title: string;
  summary: string;
  content: string;
};

export type KbEditorArticle = {
  slug: string;
  scope: KbScope;
  categoryId: KbCategoryId;
  tagKeys: string[];
  authorKey: string;
  status: KbArticleStatus;
  publishedAt: string | null;
  externalUrl: string | null;
  translations: Record<"en" | "ru", KbEditorTranslation>;
};

export type KbSearchParams = {
  scope?: KbScope;
  q?: string;
  category?: string;
  tag?: string;
  article?: string;
  folderId?: string;
  status?: KbArticleStatus | "all";
};
