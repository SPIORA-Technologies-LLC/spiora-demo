import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { validateKbTableDocument } from "@/lib/knowledge-base/table-document";
import {
  KbTableConflictError,
  sbGetKbTable,
  sbUpdateKbTable,
} from "@/lib/supabase/knowledge-base-tables-repo";

type RouteContext = { params: Promise<{ slug: string; tableId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug, tableId } = await context.params;
  try {
    const table = await sbGetKbTable(slug, tableId, session);
    if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ table });
  } catch (error) {
    console.error("[knowledge-base] get table failed", error);
    return NextResponse.json({ error: "Failed to load table" }, { status: 500 });
  }
}

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
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.accessDenied") },
      { status: 403 },
    );
  }

  const { slug, tableId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const expectedRevision =
    typeof raw.expectedRevision === "number"
      ? raw.expectedRevision
      : typeof raw.revision === "number"
        ? raw.revision
        : null;
  if (expectedRevision == null) {
    return NextResponse.json({ error: "expectedRevision required" }, { status: 400 });
  }

  let document = undefined;
  if (raw.document !== undefined) {
    const validated = validateKbTableDocument(raw.document);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    document = validated.data;
  }

  try {
    const table = await sbUpdateKbTable(
      slug,
      tableId,
      {
        title: typeof raw.title === "string" ? raw.title : undefined,
        description:
          raw.description === null || typeof raw.description === "string"
            ? (raw.description as string | null)
            : undefined,
        document,
        expectedRevision,
      },
      session,
    );
    return NextResponse.json({ table });
  } catch (error) {
    if (error instanceof KbTableConflictError) {
      return NextResponse.json(
        { error: "revision_conflict", code: "revision_conflict" },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "update_failed";
    const status = message === "Not found" ? 404 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
