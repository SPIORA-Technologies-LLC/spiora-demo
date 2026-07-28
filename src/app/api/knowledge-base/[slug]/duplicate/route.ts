import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { normalizeKbSlug } from "@/lib/knowledge-base/knowledge-base-api";
import { suggestDuplicateSlug } from "@/lib/knowledge-base/kb-slug";
import { parseKbScope } from "@/lib/knowledge-base/scope";
import {
  sbDuplicateKnowledgeBaseArticle,
  sbGetKnowledgeBaseRecord,
} from "@/lib/supabase/knowledge-base-repo";

export async function POST(
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
  const scope = parseKbScope(new URL(request.url).searchParams.get("scope"));

  let requestedSlug: string | undefined;
  try {
    const body = (await request.json()) as { slug?: string };
    if (typeof body.slug === "string") {
      requestedSlug = normalizeKbSlug(body.slug) ?? undefined;
    }
  } catch {
    /* optional body */
  }

  try {
    let candidate = requestedSlug ?? suggestDuplicateSlug(slug);
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const taken = await sbGetKnowledgeBaseRecord(candidate);
      if (!taken) break;
      candidate = suggestDuplicateSlug(slug, attempt + 1);
    }

    const article = await sbDuplicateKnowledgeBaseArticle(slug, candidate, scope);
    return NextResponse.json({ article, slug: candidate }, { status: 201 });
  } catch (error) {
    console.error("[knowledge-base] duplicate failed", error);
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.saveFailed") },
      { status: 500 },
    );
  }
}
