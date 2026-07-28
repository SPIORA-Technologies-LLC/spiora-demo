import type { KbScope } from "@/lib/knowledge-base/types";

export const DEFAULT_KB_SCOPE: KbScope = "corporate";

export function parseKbScope(raw: string | null | undefined): KbScope {
  return raw === "client" ? "client" : DEFAULT_KB_SCOPE;
}

export function buildKbScopeQuery(scope: KbScope): string {
  return scope === DEFAULT_KB_SCOPE ? "" : `scope=${encodeURIComponent(scope)}`;
}
