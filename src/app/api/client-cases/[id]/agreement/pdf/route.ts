import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { getCaseStore } from "@/lib/client-portal/case-store-selection";
import { getSignVersionForCase, readAuthorizedPdf } from "@/lib/client-portal/sign/service";
import { readRequestAuditMeta } from "@/lib/client-portal/sign/request-meta";
import { SignError } from "@/lib/client-portal/sign/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
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
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "final" ? "final" : "source";
  const download = url.searchParams.get("download") === "1";
  const caseStore = await getCaseStore();
  const intake = await caseStore.getById(id);
  const found = await getSignVersionForCase(
    id,
    url.searchParams.get("versionId"),
    undefined,
    intake?.questionnaireId,
  );
  if (!found) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  try {
    const pdf = await readAuthorizedPdf({
      versionId: found.version.id,
      kind,
      actor: { type: "employee" },
      download,
      meta: readRequestAuditMeta(request),
    });
    const safeName = pdf.fileName.replace(/["\\]/g, "");
    return new NextResponse(new Uint8Array(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof SignError) {
      return NextResponse.json({ error: error.code, code: error.code }, { status: error.httpStatus });
    }
    return NextResponse.json(
      { error: translateApiMessage(locale, "loadClientFailed") },
      { status: 500 },
    );
  }
}
