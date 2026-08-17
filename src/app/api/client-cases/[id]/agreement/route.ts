import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRequestOrigin } from "@/lib/auth/security";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { acceptAgreementByEmployee } from "@/lib/client-portal/consulting-agreement-service";
import { viewFromRecord } from "@/lib/client-portal/consulting-agreement-service";
import {
  getSignForCase,
  providerSignAgreement,
  viewWithSign,
  getSignViewForCase,
} from "@/lib/client-portal/sign/service";
import { SignError } from "@/lib/client-portal/sign/errors";
import { readRequestAuditMeta } from "@/lib/client-portal/sign/request-meta";
import { canSignConsultingAgreementAsProvider } from "@/lib/client-portal/sign/permissions";

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
    confirm?: unknown;
  } | null;

  const found = await getSignForCase(id);
  if (found) {
    const confirm = body?.confirm === true || body?.accepted === true;
    try {
      const sign = await providerSignAgreement({
        session,
        versionId: found.version.id,
        confirm,
        meta: readRequestAuditMeta(request),
      });
      return NextResponse.json(
        { agreement: { sign }, sign },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (error instanceof SignError) {
        const status = error.httpStatus;
        return NextResponse.json(
          { error: error.code, code: error.code },
          { status },
        );
      }
      return NextResponse.json(
        { error: translateApiMessage(locale, "loadClientFailed") },
        { status: 500 },
      );
    }
  }

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

  const sign = await getSignViewForCase(id, {
    canProviderSign: canSignConsultingAgreementAsProvider(session),
  });
  return NextResponse.json(
    { agreement: viewWithSign(viewFromRecord(record), sign) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
