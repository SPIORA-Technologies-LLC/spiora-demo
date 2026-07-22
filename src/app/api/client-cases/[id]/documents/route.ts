import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  addEmployeeCaseDocument,
  getEmployeeCaseDetail,
  newCaseDocumentStorageKey,
} from "@/lib/client-portal/case-service";
import { isAllowedCaseEmployeeDocument } from "@/lib/client-portal/case-employee-document-formats";
import {
  CASE_DOCUMENT_BUCKET,
  deleteCaseDocumentBytes,
  uploadCaseEmployeeDocumentBytes,
} from "@/lib/client-portal/case-document-storage";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

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
  const detail = await getEmployeeCaseDetail(id);
  if (!detail) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      clientDocuments: detail.clientDocuments,
      employeeDocuments: detail.employeeDocuments,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
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
  if (session.role !== "owner" && session.role !== "manager") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  const categoryRaw = form.get("category");
  const category =
    typeof categoryRaw === "string" && categoryRaw.trim()
      ? categoryRaw.trim().slice(0, 120)
      : null;

  if (!(file instanceof Blob) || typeof (file as File).arrayBuffer !== "function") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const fileName =
    "name" in file && typeof (file as File).name === "string"
      ? (file as File).name
      : "upload.bin";
  const sizeBytes = file.size;
  const contentType =
    typeof file.type === "string" && file.type ? file.type : "application/octet-stream";

  const allowed = isAllowedCaseEmployeeDocument(fileName, contentType, sizeBytes);
  if (!allowed.ok) {
    return NextResponse.json(
      { error: allowed.reason === "too_large" ? "FILE_TOO_LARGE" : "UNSUPPORTED_TYPE" },
      { status: 400 },
    );
  }

  const storagePath = newCaseDocumentStorageKey(id, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadCaseEmployeeDocumentBytes(storagePath, bytes, allowed.mimeType);
  } catch (error) {
    return NextResponse.json(
      {
        error: "STORAGE_UPLOAD_FAILED",
        message: error instanceof Error ? error.message : "upload failed",
      },
      { status: 503 },
    );
  }

  const result = await addEmployeeCaseDocument({
    caseId: id,
    fileName,
    mimeType: allowed.mimeType,
    sizeBytes,
    category,
    uploadedByUserId: session.id,
    uploadedByName: session.name,
    storagePath,
    storageBucket: CASE_DOCUMENT_BUCKET,
  });

  if (!result.ok) {
    await deleteCaseDocumentBytes(storagePath);
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { document: result.document },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
