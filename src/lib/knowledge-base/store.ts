import "server-only";

import type { AppLocale } from "@/i18n/config";
import {
  getEmbeddedDemoRecords,
  getEmbeddedKnowledgeBaseTextForAi,
  listEmbeddedKnowledgeBase,
} from "./embedded-store";
import {
  isKnowledgeBaseEmbeddedFallbackEnabled,
  isKnowledgeBasePostgresEnabled,
  shouldPreferEmbeddedKnowledgeBase,
} from "./config";
import type { KbArticleRecord, KbListingResponse, KbSearchParams } from "./types";

/** @deprecated Use listEmbeddedKnowledgeBase or listKnowledgeBase service. */
export async function seedDemoKnowledgeBaseIfNeeded(): Promise<KbArticleRecord[]> {
  return getEmbeddedDemoRecords();
}

/** @deprecated Use listEmbeddedKnowledgeBase or listKnowledgeBase service. */
export async function listDemoKnowledgeBase(
  locale: AppLocale,
  params: KbSearchParams = {},
): Promise<KbListingResponse> {
  return listEmbeddedKnowledgeBase(locale, params);
}

/** @deprecated Use getKnowledgeBaseTextForAi service. */
export async function getDemoKnowledgeBaseTextForAi(
  locale: AppLocale,
  userQuery: string,
): Promise<string> {
  return getEmbeddedKnowledgeBaseTextForAi(locale, userQuery);
}

/** No-op: .data/knowledge-base.json removed; seeds are always in-memory. */
export async function resetDemoKnowledgeBaseStore(): Promise<void> {
  /* intentional no-op */
}

/** Demo overrides are not persisted without PostgreSQL owner CRUD. */
export async function createDemoArticleOverride(): Promise<KbArticleRecord | null> {
  return null;
}

/** @deprecated Use knowledge-base-service.shouldUseDemoKnowledgeBase semantics via config. */
export function shouldUseDemoKnowledgeBase(): boolean {
  return (
    shouldPreferEmbeddedKnowledgeBase() ||
    (isKnowledgeBasePostgresEnabled() && isKnowledgeBaseEmbeddedFallbackEnabled())
  );
}
