import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { emptyKbTableDocument } from "@/lib/knowledge-base/table-limits";
import { validateKbTableDocument } from "@/lib/knowledge-base/table-document";
import {
  sbCreateKbTable,
  sbListKbTables,
} from "@/lib/supabase/knowledge-base-tables-repo";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json({ tables: [] });
  }

  const { slug } = await context.params;
  try {
    const tables = await sbListKbTables(slug, session, {
      includeArchived: session.role === "owner",
    });
    return NextResponse.json({ tables });
  } catch (error) {
    console.error("[knowledge-base] list tables failed", error);
    return NextResponse.json({ error: "Failed to list tables" }, { status: 500 });
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

  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  let document = emptyKbTableDocument(3, 3);
  if (raw.document !== undefined) {
    const validated = validateKbTableDocument(raw.document);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    document = validated.data;
  }

  try {
    const table = await sbCreateKbTable(
      slug,
      {
        title: typeof raw.title === "string" ? raw.title : "Untitled table",
        description: typeof raw.description === "string" ? raw.description : null,
        document,
      },
      session,
    );
    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed";
    const status =
      message === "Not found"
        ? 404
        : message === "Forbidden"
          ? 403
          : message === "Too many tables"
            ? 400
            : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
