import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { canPreviewKbAttachmentInline } from "@/lib/knowledge-base/attachment-formats";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import {
  sbArchiveKbAttachment,
  sbReadKbAttachmentBytes,
  sbUpdateKbAttachment,
} from "@/lib/supabase/knowledge-base-attachments-repo";

type RouteContext = {
  params: Promise<{ slug: string; attachmentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isKnowledgeBasePostgresEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug, attachmentId } = await context.params;
  const url = new URL(request.url);
  const dispositionParam = url.searchParams.get("disposition");

  try {
    const file = await sbReadKbAttachmentBytes(slug, attachmentId, session);
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const inlinePreferred =
      dispositionParam === "inline" ||
      (dispositionParam !== "attachment" &&
        canPreviewKbAttachmentInline(file.contentType));
    const disposition = inlinePreferred ? "inline" : "attachment";
    const encodedName = encodeURIComponent(file.dto.fileName);

    return new NextResponse(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[knowledge-base] download attachment failed", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug, attachmentId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  if (raw.action === "archive") {
    try {
      const attachment = await sbArchiveKbAttachment(slug, attachmentId, session);
      if (!attachment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ attachment });
    } catch (error) {
      console.error("[knowledge-base] archive attachment failed", error);
      return NextResponse.json({ error: "Archive failed" }, { status: 500 });
    }
  }

  try {
    const attachment = await sbUpdateKbAttachment(
      slug,
      attachmentId,
      {
        caption: typeof raw.caption === "string" || raw.caption === null ? (raw.caption as string | null) : undefined,
        sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : undefined,
        isPrimary: typeof raw.isPrimary === "boolean" ? raw.isPrimary : undefined,
      },
      session,
    );
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ attachment });
  } catch (error) {
    console.error("[knowledge-base] update attachment failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
