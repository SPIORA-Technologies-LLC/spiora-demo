import type { AppLocale } from "@/i18n/config";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";
import type { ClientContext } from "@/lib/ai/client-context";

/** Full workspace diagnostics (Google Sheets UI, scores, debug rows). */
export function isWorkspaceDiagnosticsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true") {
    return false;
  }
  return true;
}

export function formatDemoClientLookupMessage(
  locale: AppLocale,
  found: boolean,
): string {
  return translateWorkspaceMessage(
    locale,
    found ? "demoSafe.clientFound" : "demoSafe.clientNotFound",
  );
}

export type DemoSafePublicResponse = {
  demo: true;
  message: string;
};

export function buildDemoSafeBlockedResponse(
  locale: AppLocale,
): DemoSafePublicResponse {
  return {
    demo: true,
    message: translateWorkspaceMessage(locale, "demoSafe.diagnosticsHidden"),
  };
}

export function buildDemoSafeSheetsHealthResponse(
  locale: AppLocale,
  connected: boolean,
): DemoSafePublicResponse {
  return {
    demo: true,
    message: translateWorkspaceMessage(
      locale,
      connected ? "demoSafe.clientFound" : "demoSafe.clientNotFound",
    ),
  };
}

export function toDemoSafeDiagnosticResponse(
  locale: AppLocale,
  found: boolean,
): DemoSafePublicResponse {
  return {
    demo: true,
    message: formatDemoClientLookupMessage(locale, found),
  };
}

export function stripClientContextForDemoPublic(
  context: ClientContext,
): ClientContext {
  return {
    source: context.source,
    sourceLabel: context.sourceLabel,
    rowIndex: context.rowIndex,
    name: context.name,
    phone: context.phone,
    email: context.email,
    country: context.country,
    direction: context.direction,
    status: context.status,
    manager: context.manager,
    lastActivity: context.lastActivity,
    surveyData: context.surveyData,
    score: 0,
    matchedFields: [],
    debugRow: {},
  };
}

export function stripClientContextsForDemoPublic(
  contexts: ClientContext[] | null | undefined,
): ClientContext[] | undefined {
  if (!contexts?.length) return undefined;
  return contexts.map(stripClientContextForDemoPublic);
}

export function containsDiagnosticMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  const blockedKeys = [
    "resultKind",
    "topScore",
    "debugRow",
    "spreadsheetEnv",
    "gidEnv",
    "recentSearches",
    "searchColumns",
    "clientsTable",
    "newClientsTable",
    "matchedFields",
  ];

  for (const key of blockedKeys) {
    if (!(key in record)) continue;

    if (key === "matchedFields") {
      const fields = record[key];
      if (Array.isArray(fields) && fields.length === 0) continue;
    }

    if (key === "debugRow") {
      const row = record[key];
      if (
        row &&
        typeof row === "object" &&
        Object.keys(row as Record<string, unknown>).length === 0
      ) {
        continue;
      }
    }

    if (key === "score" && record[key] === 0) {
      continue;
    }

    return true;
  }

  for (const entry of Object.values(record)) {
    if (Array.isArray(entry)) {
      if (entry.some((item) => containsDiagnosticMetadata(item))) return true;
      continue;
    }
    if (entry && typeof entry === "object") {
      if (containsDiagnosticMetadata(entry)) return true;
    }
  }

  return false;
}

export function isTruthyWorkspaceDebugEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SPIORA_AI_WORKSPACE_DEBUG?.trim().toLowerCase() === "true";
}
