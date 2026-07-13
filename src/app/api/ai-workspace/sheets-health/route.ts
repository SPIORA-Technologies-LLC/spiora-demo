import { NextResponse } from "next/server";
import { getSheetsConnectionHealth } from "@/lib/ai/client-lookup";
import {
  buildDemoSafeSheetsHealthResponse,
  isWorkspaceDiagnosticsEnabled,
} from "@/lib/ai/workspace-demo-safe";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";
import { isDemoModeActive } from "@/lib/demo/debug-guard";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();

  if (isDemoModeActive()) {
    return NextResponse.json(
      { error: translateWorkspaceMessage(locale, "demoSafe.diagnosticsHidden") },
      { status: 404 },
    );
  }

  if (!isWorkspaceDiagnosticsEnabled()) {
    return NextResponse.json(buildDemoSafeSheetsHealthResponse(locale, true));
  }

  try {
    const health = await getSheetsConnectionHealth();
    return NextResponse.json(health);
  } catch (error) {
    console.error("[api/ai-workspace/sheets-health]", error);
    return NextResponse.json(
      { error: translateWorkspaceMessage(locale, "errors.generic") },
      { status: 500 },
    );
  }
}
