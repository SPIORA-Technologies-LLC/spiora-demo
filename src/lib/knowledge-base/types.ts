export type KbCategoryId =
  | "company-policies"
  | "client-workflow"
  | "document-management"
  | "team-onboarding"
  | "ai-automation";

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
};

export type KbArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categoryId: KbCategoryId;
  categoryLabel: string;
  tags: string[];
  tagLabels: string[];
  authorName: string;
  updatedAt: string;
};

export type KbArticleDetail = KbArticleListItem & {
  content: string;
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

export type KbListingResponse = {
  demo: boolean;
  source: "demo" | "google_drive" | "unconfigured" | "error";
  uploadDisabled: boolean;
  readOnly: boolean;
  categories: KbCategorySummary[];
  tags: KbTagSummary[];
  articles: KbArticleListItem[];
  selectedArticle?: KbArticleDetail;
  searchQuery?: string;
  categoryFilter?: KbCategoryId;
  tagFilter?: string;
  errorMessage?: string;
};

export type KbSearchParams = {
  q?: string;
  category?: string;
  tag?: string;
  article?: string;
  folderId?: string;
};
