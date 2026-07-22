import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getEmployeeCaseDetail } from "@/lib/client-portal/case-service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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
  const detail = await getEmployeeCaseDetail(
    id,
    locale === "ru" ? "ru" : "en",
  );
  if (!detail) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      case: detail.record,
      history: detail.history,
      comments: detail.comments,
      activity: detail.activity,
      employeeDocuments: detail.employeeDocuments,
      clientDocuments: detail.clientDocuments,
      questionnaire: detail.questionnaire,
      reviewSections: detail.reviewSections,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
