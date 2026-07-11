import "server-only";

import { NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import { isDemoMode } from "@/lib/demo/demo-mode";

export type KbDemoBlockedAction =
  | "upload"
  | "create"
  | "edit"
  | "delete";

export async function enforceKbDemoGuard(
  action: KbDemoBlockedAction,
): Promise<NextResponse | null> {
  if (!isDemoMode()) {
    return null;
  }

  const locale = await getRequestLocale();
  return NextResponse.json(
    {
      error: translateKnowledgeBaseMessage(locale, `demoGuard.${action}`),
      demo: true,
    },
    { status: 403 },
  );
}

export function isKbDemoReadOnly(): boolean {
  return isDemoMode();
}

export function isKbUploadDisabled(): boolean {
  return isDemoMode();
}

export function translateKbDemoGuard(
  locale: AppLocale,
  action: KbDemoBlockedAction,
): string {
  return translateKnowledgeBaseMessage(locale, `demoGuard.${action}`);
}
