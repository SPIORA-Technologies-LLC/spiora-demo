import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { changeCaseStatus } from "@/lib/client-portal/case-service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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
  const body = (await request.json().catch(() => ({}))) as {
    toStatus?: unknown;
    note?: unknown;
  };

  const result = await changeCaseStatus({
    caseId: id,
    toStatus: typeof body.toStatus === "string" ? body.toStatus : "",
    actorUserId: session.id,
    actorName: session.name,
    note: typeof body.note === "string" ? body.note : null,
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { error: result.code === "NOT_FOUND" ? translateApiMessage(locale, "notFound") : result.code },
      { status },
    );
  }

  return NextResponse.json(
    { case: result.case },
    { headers: { "Cache-Control": "no-store" } },
  );
}
