import type { KbCategoryId } from "./types";

export const KB_VALID_CATEGORIES = new Set<KbCategoryId>([
  "company-policies",
  "client-workflow",
  "document-management",
  "team-onboarding",
  "ai-automation",
]);

export const KB_VALID_AUTHOR_KEYS = new Set([
  "olivia-bennett",
  "daniel-cooper",
  "emma-wilson",
  "lucas-martin",
]);

export const KB_VALID_TAG_KEYS = new Set([
  "onboarding",
  "clients",
  "workflow",
  "documents",
  "templates",
  "communication",
  "compliance",
  "tasks",
  "calendar",
  "security",
  "ai",
  "reporting",
]);

export const KB_VALID_LOCALES = new Set(["en", "ru"] as const);

export type KbArticleStatus = "draft" | "published" | "archived";

export type KbTranslationInput = {
  locale: "en" | "ru";
  title: string;
  summary: string;
  content: string;
};

export type KbCreateInput = {
  slug: string;
  categoryId: KbCategoryId;
  tagKeys: string[];
  authorKey: string;
  status: "draft" | "published";
  translations: KbTranslationInput[];
};

export type KbPatchInput = {
  action?: "publish" | "archive" | "update";
  categoryId?: KbCategoryId;
  tagKeys?: string[];
  authorKey?: string;
  status?: KbArticleStatus;
  translations?: KbTranslationInput[];
};

export type KbParseError =
  | "invalid_payload"
  | "invalid_locale"
  | "invalid_status"
  | "invalid_author"
  | "invalid_tag"
  | "empty_field"
  | "archived_not_allowed_on_create"
  | "empty_patch";

export function normalizeKbSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

function parseTranslations(
  translations: unknown,
): KbTranslationInput[] | KbParseError {
  if (!Array.isArray(translations) || translations.length === 0) {
    return "invalid_payload";
  }

  const parsed: KbTranslationInput[] = [];
  const locales = new Set<string>();

  for (const entry of translations) {
    if (!entry || typeof entry !== "object") return "invalid_payload";
    const tr = entry as Record<string, unknown>;
    const locale = tr.locale;
    const title = typeof tr.title === "string" ? tr.title.trim() : "";
    const summary = typeof tr.summary === "string" ? tr.summary.trim() : "";
    const content = typeof tr.content === "string" ? tr.content.trim() : "";

    if (locale !== "en" && locale !== "ru") return "invalid_locale";
    if (!title || !summary || !content) return "empty_field";
    if (locales.has(locale)) return "invalid_payload";
    locales.add(locale);

    parsed.push({ locale, title, summary, content });
  }

  return parsed;
}

export function parseKbCreateBody(
  body: unknown,
): { ok: true; data: KbCreateInput } | { ok: false; error: KbParseError } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }

  const raw = body as Record<string, unknown>;
  const slug =
    typeof raw.slug === "string" ? normalizeKbSlug(raw.slug) : null;
  const categoryId = raw.categoryId;
  const authorKey =
    typeof raw.authorKey === "string" ? raw.authorKey.trim() : "";

  if (!slug) return { ok: false, error: "invalid_payload" };
  if (!KB_VALID_CATEGORIES.has(categoryId as KbCategoryId)) {
    return { ok: false, error: "invalid_payload" };
  }
  if (!KB_VALID_AUTHOR_KEYS.has(authorKey)) {
    return { ok: false, error: "invalid_author" };
  }

  if (raw.status === "archived") {
    return { ok: false, error: "archived_not_allowed_on_create" };
  }
  if (
    raw.status !== undefined &&
    raw.status !== "draft" &&
    raw.status !== "published"
  ) {
    return { ok: false, error: "invalid_status" };
  }

  const translations = parseTranslations(raw.translations);
  if (typeof translations === "string") {
    return { ok: false, error: translations };
  }

  const tagKeys = Array.isArray(raw.tagKeys)
    ? raw.tagKeys.filter((tag): tag is string => typeof tag === "string")
    : [];

  for (const tag of tagKeys) {
    if (!KB_VALID_TAG_KEYS.has(tag)) {
      return { ok: false, error: "invalid_tag" };
    }
  }

  return {
    ok: true,
    data: {
      slug,
      categoryId: categoryId as KbCategoryId,
      tagKeys,
      authorKey,
      status: raw.status === "published" ? "published" : "draft",
      translations,
    },
  };
}

export function parseKbPatchBody(
  body: unknown,
): { ok: true; data: KbPatchInput } | { ok: false; error: KbParseError } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }

  const raw = body as Record<string, unknown>;
  const patch: KbPatchInput = {};

  if (raw.action === "publish" || raw.action === "archive" || raw.action === "update") {
    patch.action = raw.action;
  }

  if (
    typeof raw.categoryId === "string" &&
    KB_VALID_CATEGORIES.has(raw.categoryId as KbCategoryId)
  ) {
    patch.categoryId = raw.categoryId as KbCategoryId;
  } else if (raw.categoryId !== undefined) {
    return { ok: false, error: "invalid_payload" };
  }

  if (Array.isArray(raw.tagKeys)) {
    const tagKeys = raw.tagKeys.filter((tag): tag is string => typeof tag === "string");
    for (const tag of tagKeys) {
      if (!KB_VALID_TAG_KEYS.has(tag)) return { ok: false, error: "invalid_tag" };
    }
    patch.tagKeys = tagKeys;
  }

  if (typeof raw.authorKey === "string") {
    const authorKey = raw.authorKey.trim();
    if (!KB_VALID_AUTHOR_KEYS.has(authorKey)) {
      return { ok: false, error: "invalid_author" };
    }
    patch.authorKey = authorKey;
  }

  if (raw.status !== undefined) {
    if (
      raw.status !== "draft" &&
      raw.status !== "published" &&
      raw.status !== "archived"
    ) {
      return { ok: false, error: "invalid_status" };
    }
    patch.status = raw.status;
  }

  if (Array.isArray(raw.translations)) {
    const translations = parseTranslations(raw.translations);
    if (typeof translations === "string") {
      return { ok: false, error: translations };
    }
    patch.translations = translations;
  }

  const hasMutation =
    patch.action !== undefined ||
    patch.categoryId !== undefined ||
    patch.tagKeys !== undefined ||
    patch.authorKey !== undefined ||
    patch.status !== undefined ||
    patch.translations !== undefined;

  if (!hasMutation) {
    return { ok: false, error: "empty_patch" };
  }

  return { ok: true, data: patch };
}

export function isXssSafeMarkdownInput(content: string): boolean {
  return !/<script\b/i.test(content) && !/javascript:/i.test(content);
}

export function resolvePublishedAtForUpsert(
  status: KbArticleStatus,
  existingPublishedAt: string | null,
  now: string,
): string | null {
  if (status === "published") {
    return existingPublishedAt ?? now;
  }
  return null;
}

export function resolveArchivedAtForUpsert(
  status: KbArticleStatus,
  now: string,
): string | null {
  return status === "archived" ? now : null;
}
