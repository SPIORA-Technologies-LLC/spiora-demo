import "server-only";

import type { AppLocale } from "@/i18n/config";
import { DEMO_KB_ARTICLE_SEEDS } from "./demo-articles";
import { buildDemoAiKnowledgeBaseText, searchDemoArticles } from "./resolve-articles";
import type {
  KbArticleRecord,
  KbListingResponse,
  KbSearchParams,
  KbScope,
} from "./types";

function seedDemoRecords(scope: KbScope): KbArticleRecord[] {
  if (scope === "client") return [];
  const now = new Date().toISOString();
  return DEMO_KB_ARTICLE_SEEDS.map((seed) => ({
    ...seed,
    id: seed.slug,
    createdAt: now,
    scope,
  }));
}

/** In-memory embedded articles from code + i18n (no .data/knowledge-base.json). */
export function listEmbeddedKnowledgeBase(
  locale: AppLocale,
  params: KbSearchParams = {},
): KbListingResponse {
  const listing = searchDemoArticles(
    seedDemoRecords(params.scope ?? "corporate"),
    locale,
    params,
  );
  return {
    ...listing,
    source: "embedded",
    demo: true,
  };
}

export function getEmbeddedKnowledgeBaseTextForAi(
  locale: AppLocale,
  userQuery: string,
  scope: KbScope = "corporate",
): string {
  return buildDemoAiKnowledgeBaseText(seedDemoRecords(scope), locale, userQuery);
}

export function getEmbeddedDemoRecords(): KbArticleRecord[] {
  return seedDemoRecords("corporate");
}
