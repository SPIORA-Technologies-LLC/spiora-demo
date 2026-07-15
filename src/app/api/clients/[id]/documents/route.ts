import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  ClientDocumentsAccessError,
  ClientDocumentsStorageError,
  createClientDocumentMetadata,
  listClientDocuments,
} from "@/lib/clients/client-documents-store";
import { ClientDataValidationError } from "@/lib/clients/client-data-validation";
import { mapDocumentPublicToClientDocument } from "@/lib/clients/client-data-map";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

type RouteContext = { params: Promise<{ id: string }> };

function handleError(error: unknown, locale: Awaited<ReturnType<typeof getRequestLocale>>) {
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
    { error: translateApiMessage(locale, "loadClientFailed") },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const result = await listClientDocuments(id, session);
    return NextResponse.json({
      documents: result.items.map(mapDocumentPublicToClientDocument),
      source: result.source,
    });
  } catch (error) {
    return handleError(error, locale);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const document = await createClientDocumentMetadata(id, session, {
      fileName: typeof body.fileName === "string" ? body.fileName : "",
      originalFileName:
        typeof body.originalFileName === "string"
          ? body.originalFileName
          : undefined,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : undefined,
      documentType:
        typeof body.documentType === "string" ? body.documentType : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      storageProvider:
        typeof body.storageProvider === "string"
          ? body.storageProvider
          : "demo",
      storagePath:
        typeof body.storagePath === "string" ? body.storagePath : undefined,
    });
    return NextResponse.json({
      document: mapDocumentPublicToClientDocument(document),
    });
  } catch (error) {
    return handleError(error, locale);
  }
}
