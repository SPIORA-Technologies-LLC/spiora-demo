import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import {
  sbArchiveKbLink,
  sbUpdateKbLink,
} from "@/lib/supabase/knowledge-base-links-repo";

type RouteContext = {
  params: Promise<{ slug: string; linkId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug, linkId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  if (raw.action === "archive") {
    try {
      const link = await sbArchiveKbLink(slug, linkId, session);
      if (!link) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ link });
    } catch (error) {
      console.error("[knowledge-base] archive link failed", error);
      return NextResponse.json({ error: "Archive failed" }, { status: 500 });
    }
  }

  try {
    const link = await sbUpdateKbLink(
      slug,
      linkId,
      {
        label:
          typeof raw.label === "string" || raw.label === null
            ? (raw.label as string | null)
            : undefined,
        url: typeof raw.url === "string" ? raw.url : undefined,
      },
      session,
    );
    if (!link) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    if (message === "Invalid URL") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    console.error("[knowledge-base] update link failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
