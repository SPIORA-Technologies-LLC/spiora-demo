import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { addCaseComment } from "@/lib/client-portal/case-service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }
  if (session.role !== "owner" && session.role !== "manager") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { body?: unknown };
  const result = await addCaseComment({
    caseId: id,
    authorUserId: session.id,
    authorName: session.name,
    body: typeof body.body === "string" ? body.body : "",
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { error: result.code },
      { status },
    );
  }

  return NextResponse.json(
    { comment: result.comment },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
