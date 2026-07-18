import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKbUploadDisabled } from "@/lib/knowledge-base/demo-guard";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import {
  sbListKbAttachments,
  sbUploadKbAttachment,
} from "@/lib/supabase/knowledge-base-attachments-repo";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json({ attachments: [] });
  }

  const { slug } = await context.params;
  try {
    const attachments = await sbListKbAttachments(slug, session, {
      includeArchived: session.role === "owner",
    });
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[knowledge-base] list attachments failed", error);
    return NextResponse.json({ error: "Failed to list attachments" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  if (session.role !== "owner") {
    return NextResponse.json(
      { error: translateKnowledgeBaseMessage(locale, "errors.accessDenied") },
      { status: 403 },
    );
  }

  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json(
      {
        error: translateKnowledgeBaseMessage(
          locale,
          isKbUploadDisabled() ? "demoGuard.upload" : "errors.accessDenied",
        ),
      },
      { status: 403 },
    );
  }

  const { slug } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());

  try {
    const attachment = await sbUploadKbAttachment(
      slug,
      {
        buffer,
        fileName: fileEntry.name || "file",
        contentType: fileEntry.type || "application/octet-stream",
        size: buffer.length,
      },
      session,
    );
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message === "File too large"
        ? 413
        : message === "Forbidden"
          ? 403
          : message === "Not found"
            ? 404
            : message === "Too many attachments" ||
                message === "Unsupported file type" ||
                message === "Blocked file type" ||
                message === "Empty file" ||
                message === "MIME mismatch"
              ? 400
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
