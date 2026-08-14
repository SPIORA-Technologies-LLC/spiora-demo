import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import {
  archiveIntakeCase,
  getEmployeeCaseDetail,
} from "@/lib/client-portal/case-service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { CaseStoreConfigurationError } from "@/lib/client-portal/case-store";

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
      agreement: detail.agreement,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request, context: RouteContext) {
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

  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host");
  const originCheck = checkRequestOrigin(originHeader, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  try {
    const ok = await archiveIntakeCase(id);
    if (!ok) {
      return NextResponse.json(
        { error: translateApiMessage(locale, "notFound") },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CaseStoreConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 },
      );
    }
    throw error;
  }
}
