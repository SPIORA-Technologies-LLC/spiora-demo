import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import {
  MAX_KB_TABLE_CSV_BYTES,
  type KbTableColumnType,
} from "@/lib/knowledge-base/table-limits";
import { csvMatrixToDocument, parseCsvText } from "@/lib/knowledge-base/table-csv";
import { sbCreateKbTable } from "@/lib/supabase/knowledge-base-tables-repo";

type RouteContext = { params: Promise<{ slug: string }> };

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
  const contentType = request.headers.get("content-type") ?? "";

  let csvText = "";
  let headerRow = true;
  let title = "Imported table";
  let types: KbTableColumnType[] | undefined;
  let previewOnly = false;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      if (file.size > MAX_KB_TABLE_CSV_BYTES) {
        return NextResponse.json({ error: "too_large" }, { status: 400 });
      }
      csvText = await file.text();
      headerRow = form.get("headerRow") !== "false";
      previewOnly = form.get("preview") === "true";
      const titleField = form.get("title");
      if (typeof titleField === "string" && titleField.trim()) title = titleField.trim();
      const typesField = form.get("types");
      if (typeof typesField === "string" && typesField.trim()) {
        try {
          types = JSON.parse(typesField) as KbTableColumnType[];
        } catch {
          types = undefined;
        }
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.csv !== "string") {
        return NextResponse.json({ error: "csv required" }, { status: 400 });
      }
      csvText = body.csv;
      if (Buffer.byteLength(csvText, "utf8") > MAX_KB_TABLE_CSV_BYTES) {
        return NextResponse.json({ error: "too_large" }, { status: 400 });
      }
      headerRow = body.headerRow !== false;
      previewOnly = body.preview === true;
      if (typeof body.title === "string" && body.title.trim()) title = body.title.trim();
      if (Array.isArray(body.types)) types = body.types as KbTableColumnType[];
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = parseCsvText(csvText);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const built = csvMatrixToDocument(parsed.data.matrix, { headerRow, types });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  if (previewOnly) {
    return NextResponse.json({
      preview: {
        delimiter: parsed.data.delimiter,
        columns: built.data.columns.map((c) => ({ name: c.name, type: c.type })),
        rowCount: built.data.rows.length,
        sampleRows: built.data.rows.slice(0, 5),
      },
      document: built.data,
    });
  }

  try {
    const table = await sbCreateKbTable(
      slug,
      { title, document: built.data },
      session,
    );
    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "import_failed";
    const status = message === "Not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
