import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isKnowledgeBasePostgresEnabled } from "@/lib/knowledge-base/config";
import { generateKbAiDraft } from "@/lib/knowledge-base/kb-ai-draft";

export async function POST(request: Request) {
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
      { error: translateKnowledgeBaseMessage(locale, "errors.accessDenied") },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt =
    body && typeof body === "object" && typeof (body as { prompt?: string }).prompt === "string"
      ? (body as { prompt: string }).prompt.trim()
      : "";

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const draft = generateKbAiDraft(prompt, "olivia-bennett");
  return NextResponse.json({ draft });
}
