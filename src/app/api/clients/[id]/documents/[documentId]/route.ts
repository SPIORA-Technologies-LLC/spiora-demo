import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  archiveClientDocumentMetadata,
  ClientDocumentsAccessError,
  ClientDocumentsStorageError,
  getClientDocumentFile,
  updateClientDocumentMetadata,
} from "@/lib/clients/client-documents-store";
import { ClientDataValidationError } from "@/lib/clients/client-data-validation";
import { mapDocumentPublicToClientDocument } from "@/lib/clients/client-data-map";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

function handleError(
  error: unknown,
  locale: Awaited<ReturnType<typeof getRequestLocale>>,
) {
  if (error instanceof ClientDocumentsAccessError) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }
  if (error instanceof ClientDataValidationError) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "validationFailed") },
      { status: 400 },
    );
  }
  if (error instanceof ClientDocumentsStorageError) {
    const status = error.message.includes("not found") ? 404 : 503;
    return NextResponse.json(
      {
        error: translateApiMessage(
          locale,
          status === 404 ? "notFound" : "crmStorageUnavailable",
        ),
      },
      { status },
    );
  }
  return NextResponse.json(
    { error: translateApiMessage(locale, "updateClientFailed") },
    { status: 500 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id, documentId } = await context.params;

  try {
    const file = await getClientDocumentFile(id, documentId, session);
    if (!file) {
      return NextResponse.json(
        { error: translateApiMessage(locale, "notFound") },
        { status: 404 },
      );
    }

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const safeAsciiName = file.fileName
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_");
    const utf8Name = encodeURIComponent(file.fileName);

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeAsciiName}"; filename*=UTF-8''${utf8Name}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error, locale);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id, documentId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const document = await updateClientDocumentMetadata(id, documentId, session, {
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      documentType:
        typeof body.documentType === "string" ? body.documentType : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
    });
    return NextResponse.json({
      document: mapDocumentPublicToClientDocument(document),
    });
  } catch (error) {
    return handleError(error, locale);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id, documentId } = await context.params;

  try {
    await archiveClientDocumentMetadata(id, documentId, session);
    return NextResponse.json({ ok: true, archivedId: documentId });
  } catch (error) {
    return handleError(error, locale);
  }
}
