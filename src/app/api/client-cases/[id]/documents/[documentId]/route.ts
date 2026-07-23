import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCaseDocument } from "@/lib/client-portal/case-service";
import {
  createCaseDocumentSignedUrl,
  readCaseDocumentBytes,
} from "@/lib/client-portal/case-document-storage";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

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

  const { id, documentId } = await context.params;
  const document = await getCaseDocument(id, documentId);
  if (!document) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  if (url.searchParams.get("signed") === "1") {
    const signedUrl = await createCaseDocumentSignedUrl(document.storagePath, 120);
    if (!signedUrl) {
      return NextResponse.json({ error: "SIGNED_URL_UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json(
      { url: signedUrl, expiresIn: 120 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const bytes = await readCaseDocumentBytes(document.storageBucket, document.storagePath);
  if (!bytes) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  const inline = url.searchParams.get("inline") === "1";
  const safeAsciiName = document.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const utf8Name = encodeURIComponent(document.fileName);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeAsciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "no-store",
    },
  });
}
