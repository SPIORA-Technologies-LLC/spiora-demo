import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { listKnowledgeBaseFolder } from "@/lib/google-drive/kb-drive";
import { isGoogleDriveKbConfigured } from "@/lib/google-sheets/auth";
import { isKbUploadDisabled } from "@/lib/knowledge-base/demo-guard";
import {
  listDemoKnowledgeBase,
  shouldUseDemoKnowledgeBase,
} from "@/lib/knowledge-base/store";
import type { KbCategoryId, KbSearchParams } from "@/lib/knowledge-base/types";
import { isDemoMode } from "@/lib/demo/demo-mode";

const VALID_CATEGORIES = new Set<KbCategoryId>([
  "company-policies",
  "client-workflow",
  "document-management",
  "team-onboarding",
  "ai-automation",
]);

function parseSearchParams(url: URL): KbSearchParams {
  const category = url.searchParams.get("category") ?? undefined;
  return {
    q: url.searchParams.get("q") ?? undefined,
    category:
      category && VALID_CATEGORIES.has(category as KbCategoryId)
        ? category
        : undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    article: url.searchParams.get("article") ?? undefined,
    folderId: url.searchParams.get("folderId") ?? undefined,
  } as KbSearchParams & { folderId?: string };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const url = new URL(request.url);
  const params = parseSearchParams(url);

  if (shouldUseDemoKnowledgeBase()) {
    const listing = await listDemoKnowledgeBase(locale, params);
    return NextResponse.json({
      ...listing,
      uploadDisabled: isKbUploadDisabled(),
      readOnly: true,
    });
  }

  if (!isGoogleDriveKbConfigured()) {
    return NextResponse.json({
      demo: false,
      source: "unconfigured",
      uploadDisabled: isDemoMode(),
      readOnly: isDemoMode(),
      categories: [],
      tags: [],
      articles: [],
      errorMessage: translateKnowledgeBaseMessage(locale, "empty.unconfigured"),
    });
  }

  const listing = await listKnowledgeBaseFolder(params.folderId, locale);
  return NextResponse.json({
    ...listing,
    demo: false,
    uploadDisabled: isKbUploadDisabled(),
    readOnly: isDemoMode(),
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  return NextResponse.json(
    {
      error: translateKnowledgeBaseMessage(
        locale,
        isDemoMode() ? "demoGuard.create" : "errors.accessDenied",
      ),
      demo: isDemoMode(),
    },
    { status: 403 },
  );
}
