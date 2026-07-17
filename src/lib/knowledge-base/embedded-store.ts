import "server-only";

import type { AppLocale } from "@/i18n/config";
import { DEMO_KB_ARTICLE_SEEDS } from "./demo-articles";
import { buildDemoAiKnowledgeBaseText, searchDemoArticles } from "./resolve-articles";
import type {
  KbArticleRecord,
  KbListingResponse,
  KbSearchParams,
} from "./types";

function seedDemoRecords(): KbArticleRecord[] {
  const now = new Date().toISOString();
  return DEMO_KB_ARTICLE_SEEDS.map((seed) => ({
    ...seed,
    id: seed.slug,
    createdAt: now,
  }));
}

/** In-memory embedded articles from code + i18n (no .data/knowledge-base.json). */
export function listEmbeddedKnowledgeBase(
  locale: AppLocale,
  params: KbSearchParams = {},
): KbListingResponse {
  const listing = searchDemoArticles(seedDemoRecords(), locale, params);
  return {
    ...listing,
    source: "embedded",
    demo: true,
  };
}

export function getEmbeddedKnowledgeBaseTextForAi(
  locale: AppLocale,
  userQuery: string,
): string {
  return buildDemoAiKnowledgeBaseText(seedDemoRecords(), locale, userQuery);
}

export function getEmbeddedDemoRecords(): KbArticleRecord[] {
  return seedDemoRecords();
}
