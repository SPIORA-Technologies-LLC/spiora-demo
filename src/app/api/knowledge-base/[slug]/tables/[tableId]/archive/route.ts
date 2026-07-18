import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { sbArchiveKbTable } from "@/lib/supabase/knowledge-base-tables-repo";

type RouteContext = { params: Promise<{ slug: string; tableId: string }> };

export async function POST(_request: Request, context: RouteContext) {
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

  const { slug, tableId } = await context.params;
  try {
    const table = await sbArchiveKbTable(slug, tableId, session);
    return NextResponse.json({ table });
  } catch (error) {
    const message = error instanceof Error ? error.message : "archive_failed";
    const status = message === "Not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
