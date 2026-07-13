import { NextResponse } from "next/server";
import { getClientsDiagnosticReport } from "@/lib/ai/clients-diagnostic";
import { lookupAllClientMatches } from "@/lib/ai/client-lookup";
import {
  buildDemoSafeBlockedResponse,
  isWorkspaceDiagnosticsEnabled,
  toDemoSafeDiagnosticResponse,
} from "@/lib/ai/workspace-demo-safe";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";
import { isDemoModeActive } from "@/lib/demo/debug-guard";

export async function GET(request: Request) {
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
    const query = new URL(request.url).searchParams.get("query")?.trim();
    if (query) {
      const matches = await lookupAllClientMatches(query);
      return NextResponse.json(
        toDemoSafeDiagnosticResponse(locale, matches.length > 0),
      );
    }
    return NextResponse.json(buildDemoSafeBlockedResponse(locale));
  }

  try {
    const report = await getClientsDiagnosticReport();
    return NextResponse.json(report);
  } catch (error) {
    console.error("[api/ai-workspace/clients-diagnostic]", error);
    return NextResponse.json(
      { error: translateWorkspaceMessage(locale, "errors.generic") },
      { status: 500 },
    );
  }
}
