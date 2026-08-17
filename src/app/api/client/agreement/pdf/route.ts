import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-portal/session";
import { clientApiError } from "@/lib/client-portal/api-errors";
import { readAuthorizedPdf } from "@/lib/client-portal/sign/service";
import { signErrorResponse } from "@/lib/client-portal/sign/http";
import { readRequestAuditMeta } from "@/lib/client-portal/sign/request-meta";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const url = new URL(request.url);
  const versionId = url.searchParams.get("versionId") ?? "";
  const kind = url.searchParams.get("kind") === "final" ? "final" : "source";
  const download = url.searchParams.get("download") === "1";
  if (!versionId) return clientApiError("INVALID_BODY", 400);

  try {
    const pdf = await readAuthorizedPdf({
      versionId,
      kind,
      actor: { type: "client", portalUserId: session.id },
      download,
      meta: readRequestAuditMeta(request),
    });
    return new NextResponse(new Uint8Array(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return signErrorResponse(error);
  }
}
