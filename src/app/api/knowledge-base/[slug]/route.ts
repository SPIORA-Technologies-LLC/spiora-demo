import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import {
  isXssSafeMarkdownInput,
  parseKbPatchBody,
} from "@/lib/knowledge-base/knowledge-base-api";
import {
  sbArchiveKnowledgeBaseArticle,
  sbGetKnowledgeBaseBySlug,
  sbGetKnowledgeBaseRecord,
  sbUpsertKnowledgeBaseArticle,
  type KbUpsertInput,
} from "@/lib/supabase/knowledge-base-repo";

function parseErrorStatus(error: import("@/lib/knowledge-base/knowledge-base-api").KbParseError): number {
  switch (error) {
    case "invalid_locale":
    case "invalid_status":
    case "invalid_author":
    case "invalid_tag":
    case "empty_field":
    case "empty_patch":
      return 400;
    default:
      return 400;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const { slug } = await context.params;

  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.accessDenied") },
      { status: 403 },
    );
  }

  try {
    const article = await sbGetKnowledgeBaseBySlug(slug, locale);
    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (error) {
    console.error("[knowledge-base] get by slug failed", error);
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.loadFailed") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();

  if (session.role !== "owner") {
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.accessDenied") },
      { status: 403 },
    );
  }

  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.accessDenied") },
      { status: 403 },
    );
  }

  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseKbPatchBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid patch payload", code: parsed.error },
      { status: parseErrorStatus(parsed.error) },
    );
  }

  const patch = parsed.data;

  if (patch.translations) {
    for (const tr of patch.translations) {
      if (!isXssSafeMarkdownInput(tr.content)) {
        return NextResponse.json({ error: "Unsafe content" }, { status: 400 });
      }
    }
  }

  try {
    const record = await sbGetKnowledgeBaseRecord(slug);
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (record.status === "archived" && patch.action === "publish") {
      return NextResponse.json(
        { error: "Archived articles cannot be republished in Phase 1" },
        { status: 409 },
      );
    }

    if (patch.action === "archive" || patch.status === "archived") {
      await sbArchiveKnowledgeBaseArticle(slug);
      const article = await sbGetKnowledgeBaseBySlug(slug, locale);
      return NextResponse.json({ article });
    }

    const existing = await sbGetKnowledgeBaseBySlug(slug, locale);

    const status =
      patch.action === "publish"
        ? "published"
        : patch.status ?? record.status;

    const input: KbUpsertInput = {
      slug,
      categoryId: patch.categoryId ?? record.category_id,
      tagKeys: patch.tagKeys ?? record.tag_keys,
      authorKey: patch.authorKey ?? record.author_key,
      status,
      externalUrl:
        patch.externalUrl !== undefined
          ? patch.externalUrl
          : (record.external_url ?? null),
      translations:
        patch.translations ??
        (existing
          ? [
              {
                locale: locale === "ru" ? "ru" : "en",
                title: existing.title,
                summary: existing.summary,
                content: existing.content,
              },
            ]
          : []),
    };

    if (input.translations.length === 0) {
      return NextResponse.json({ error: "Missing translations" }, { status: 400 });
    }

    const article = await sbUpsertKnowledgeBaseArticle(input, {
      existingPublishedAt: record.published_at,
    });
    return NextResponse.json({ article });
  } catch (error) {
    console.error("[knowledge-base] patch failed", error);
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.saveFailed") },
      { status: 500 },
    );
  }
}
