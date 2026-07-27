import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import { canViewFinance } from "@/lib/finance/permissions";
import {
  CaseCrmLinkError,
  ensureCrmClientForCase,
} from "@/lib/client-portal/case-crm-link";
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
  if (!canViewFinance(session)) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  // Intake case APIs are owner/manager; Finance tab is owner (finance_manager
  // has no intake nav). Still require staff intake role for case access.
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
    const result = await ensureCrmClientForCase(id, session);
    return NextResponse.json(
      {
        externalId: result.externalId,
        clientUuid: result.clientUuid,
        created: result.created,
        linked: result.linked,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CaseCrmLinkError) {
      const status =
        error.code === "CASE_NOT_FOUND"
          ? 404
          : error.code === "FINANCE_ACCESS_DENIED" ||
              error.code === "CRM_CREATE_FORBIDDEN"
            ? 403
            : error.code === "CRM_UNAVAILABLE"
              ? 503
              : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    throw error;
  }
}
