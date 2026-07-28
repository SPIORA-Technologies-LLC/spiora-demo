import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { parseKbScope } from "@/lib/knowledge-base/scope";
import { sbGetKnowledgeBaseEditorArticle } from "@/lib/supabase/knowledge-base-repo";

export async function GET(
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

  try {
    const article = await sbGetKnowledgeBaseEditorArticle(slug, scope);
    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (error) {
    console.error("[knowledge-base] editor load failed", error);
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.loadFailed") },
      { status: 500 },
    );
  }
}
