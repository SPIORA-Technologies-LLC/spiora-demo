import "server-only";

import { NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateAdminMessage } from "@/i18n/admin-messages";
import { isDemoMode } from "@/lib/demo/demo-mode";

export type AdminDemoBlockedAction =
  | "teamDelete"
  | "teamInvite"
  | "teamRoleChange"
  | "settingsPasswordReset"
  | "settingsCompany"
  | "settingsIntegrations"
  | "analyticsExport";

export async function enforceAdminDemoGuard(
  action: AdminDemoBlockedAction,
): Promise<NextResponse | null> {
  if (!isDemoMode()) {
    return null;
  }

  const locale = await getRequestLocale();
  return NextResponse.json(
    {
      error: translateAdminMessage(locale, `demoGuard.${action}`),
      demo: true,
    },
    { status: 403 },
  );
}

export function isAdminDemoPreviewOnly(): boolean {
  return isDemoMode();
}

export function translateAdminDemoGuard(
  locale: AppLocale,
  action: AdminDemoBlockedAction,
): string {
  return translateAdminMessage(locale, `demoGuard.${action}`);
}
