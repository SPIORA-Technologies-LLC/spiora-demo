import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { acceptAgreementByEmployee } from "@/lib/client-portal/consulting-agreement-service";
import { viewFromRecord } from "@/lib/client-portal/consulting-agreement-service";

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

  const originCheck = checkRequestOrigin(
    request.headers.get("origin"),
    request.headers.get("host"),
  );
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    accepted?: unknown;
  } | null;
  if (!body || typeof body.accepted !== "boolean") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "validationFailed") },
      { status: 400 },
    );
  }

  const record = await acceptAgreementByEmployee({
    caseId: id,
    employeeUserId: session.id,
    accepted: body.accepted,
  });
  if (!record) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { agreement: viewFromRecord(record) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
