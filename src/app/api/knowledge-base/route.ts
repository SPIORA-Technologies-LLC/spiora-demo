import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { resolveKbRequestLocale } from "@/lib/knowledge-base/kb-locale";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { listKnowledgeBaseFolder } from "@/lib/google-drive/kb-drive";
import { isGoogleDriveKbConfigured } from "@/lib/google-sheets/auth";
import { isKbUploadDisabled } from "@/lib/knowledge-base/demo-guard";
import {
  isKnowledgeBasePostgresEnabled,
  shouldPreferEmbeddedKnowledgeBase,
} from "@/lib/knowledge-base/config";
import {
  isXssSafeMarkdownInput,
  parseKbCreateBody,
} from "@/lib/knowledge-base/knowledge-base-api";
import { listKnowledgeBase } from "@/lib/knowledge-base/knowledge-base-service";
import type { KbArticleStatus, KbCategoryId, KbSearchParams } from "@/lib/knowledge-base/types";
import {
  sbGetKnowledgeBaseRecord,
  sbUpsertKnowledgeBaseArticle,
  type KbUpsertInput,
} from "@/lib/supabase/knowledge-base-repo";
import { isDemoMode } from "@/lib/demo/demo-mode";

const VALID_CATEGORIES = new Set<KbCategoryId>([
  "company-policies",
  "client-workflow",
  "document-management",
  "team-onboarding",
  "ai-automation",
]);

const VALID_STATUSES = new Set<KbArticleStatus | "all">([
  "published",
  "draft",
  "archived",
  "all",
]);

function parseSearchParams(url: URL, isOwner: boolean): KbSearchParams {
  const category = url.searchParams.get("category") ?? undefined;
  const rawStatus = url.searchParams.get("status") ?? undefined;
  const status =
    isOwner && rawStatus && VALID_STATUSES.has(rawStatus as KbArticleStatus | "all")
      ? (rawStatus as KbArticleStatus | "all")
      : undefined;
  return {
    q: url.searchParams.get("q") ?? undefined,
    category:
      category && VALID_CATEGORIES.has(category as KbCategoryId)
        ? category
        : undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    article: url.searchParams.get("article") ?? undefined,
    folderId: url.searchParams.get("folderId") ?? undefined,
    status,
  } as KbSearchParams & { folderId?: string };
}

function parseErrorStatus(error: import("@/lib/knowledge-base/knowledge-base-api").KbParseError): number {
  switch (error) {
    case "invalid_locale":
    case "invalid_status":
    case "invalid_author":
    case "invalid_tag":
    case "empty_field":
    case "archived_not_allowed_on_create":
      return 400;
    default:
      return 400;
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieLocale = await getRequestLocale();
  const url = new URL(request.url);
  const locale = resolveKbRequestLocale(url.searchParams.get("locale"), cookieLocale);
  const params = parseSearchParams(url, session.role === "owner");

  if (
    isKnowledgeBasePostgresEnabled() ||
    shouldPreferEmbeddedKnowledgeBase()
  ) {
    const listing = await listKnowledgeBase(locale, params, session);
    return NextResponse.json(listing);
  }

  if (!isGoogleDriveKbConfigured()) {
    return NextResponse.json({
      demo: false,
      source: "unconfigured",
      uploadDisabled: isKbUploadDisabled(),
      readOnly: isDemoMode(),
      categories: [],
      tags: [],
      articles: [],
      errorMessage: translateKnowledgeBaseMessage(locale, "empty.unconfigured"),
    });
  }

  const listing = await listKnowledgeBaseFolder(params.folderId, locale);
  return NextResponse.json({
    ...listing,
    demo: false,
    uploadDisabled: isKbUploadDisabled(),
    readOnly: isDemoMode(),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();

  if (session.role !== "owner") {
    return NextResponse.json(
      {
        error: translateKnowledgeBaseMessage(locale, "errors.accessDenied"),
      },
      { status: 403 },
    );
  }

  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json(
      {
        error: translateKnowledgeBaseMessage(
          locale,
          isDemoMode() ? "demoGuard.create" : "errors.accessDenied",
        ),
        demo: isDemoMode(),
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseKbCreateBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid article payload", code: parsed.error },
      { status: parseErrorStatus(parsed.error) },
    );
  }

  for (const tr of parsed.data.translations) {
    if (!isXssSafeMarkdownInput(tr.content)) {
      return NextResponse.json({ error: "Unsafe content" }, { status: 400 });
    }
  }

  const existing = await sbGetKnowledgeBaseRecord(parsed.data.slug);
  if (existing) {
    return NextResponse.json(
      { error: "Article slug already exists" },
      { status: 409 },
    );
  }

  const input: KbUpsertInput = {
    slug: parsed.data.slug,
    categoryId: parsed.data.categoryId,
    tagKeys: parsed.data.tagKeys,
    authorKey: parsed.data.authorKey,
    status: parsed.data.status,
    externalUrl: parsed.data.externalUrl,
    translations: parsed.data.translations,
  };

  try {
    const article = await sbUpsertKnowledgeBaseArticle(input);
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("[knowledge-base] create failed", error);
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.saveFailed") },
      { status: 500 },
    );
  }
}
