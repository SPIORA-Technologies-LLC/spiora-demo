import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKbUploadDisabled } from "@/lib/knowledge-base/demo-guard";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import {
  sbCreateKbLink,
  sbListKbLinks,
} from "@/lib/supabase/knowledge-base-links-repo";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json({ links: [] });
  }

  const { slug } = await context.params;
  try {
    const links = await sbListKbLinks(slug, session, {
      includeArchived: session.role === "owner",
    });
    return NextResponse.json({ links });
  } catch (error) {
    console.error("[knowledge-base] list links failed", error);
    return NextResponse.json({ error: "Failed to list links" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
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
      {
        error: translateKnowledgeBaseMessage(
          locale,
          isKbUploadDisabled() ? "demoGuard.upload" : "errors.accessDenied",
        ),
      },
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

  const raw = body as Record<string, unknown>;
  const url = typeof raw.url === "string" ? raw.url : "";
  const label =
    typeof raw.label === "string" || raw.label === null ? (raw.label as string | null) : undefined;

  try {
    const link = await sbCreateKbLink(slug, { url, label }, session);
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    if (message === "Not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (message === "Invalid URL") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (message === "Too many links") {
      return NextResponse.json({ error: "Too many links" }, { status: 409 });
    }
    console.error("[knowledge-base] create link failed", error);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
