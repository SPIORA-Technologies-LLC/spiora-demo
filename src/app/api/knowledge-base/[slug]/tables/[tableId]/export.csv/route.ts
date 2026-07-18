import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { documentToCsv } from "@/lib/knowledge-base/table-csv";
import { sbGetKbTable } from "@/lib/supabase/knowledge-base-tables-repo";

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

    const csv = documentToCsv(table.document);
    const safeName = table.title.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "table";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[knowledge-base] export csv failed", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
