import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { cancelAgreementVersion } from "@/lib/client-portal/sign/service";
import { SignError } from "@/lib/client-portal/sign/errors";
import { readRequestAuditMeta } from "@/lib/client-portal/sign/request-meta";

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
  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const { id } = await context.params;
  try {
    const sign = await cancelAgreementVersion({
      caseId: id,
      actor: session,
      reason: typeof body?.reason === "string" ? body.reason : null,
      meta: readRequestAuditMeta(request),
    });
    return NextResponse.json({ sign }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SignError) {
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { error: translateApiMessage(locale, "loadClientFailed") },
      { status: 500 },
    );
  }
}
