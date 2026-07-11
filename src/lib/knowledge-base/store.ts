import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppLocale } from "@/i18n/config";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DEMO_KB_ARTICLE_SEEDS } from "./demo-articles";
import {
  buildDemoAiKnowledgeBaseText,
  searchDemoArticles,
} from "./resolve-articles";
import type {
  KbArticleRecord,
  KbListingResponse,
  KbSearchParams,
} from "./types";

const STORE_PATH = path.join(process.cwd(), ".data", "knowledge-base.json");

type KbStore = {
  articles: KbArticleRecord[];
  seededAt?: string;
};

async function ensureStoreDir(): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

function seedDemoRecords(): KbArticleRecord[] {
  const now = new Date().toISOString();
  return DEMO_KB_ARTICLE_SEEDS.map((seed) => ({
    ...seed,
    id: seed.slug,
    createdAt: now,
  }));
}

async function readStore(): Promise<KbStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as KbStore;
    if (Array.isArray(parsed.articles)) {
      return parsed;
    }
  } catch {
    /* first run */
  }
  return { articles: [] };
}

async function writeStore(store: KbStore): Promise<void> {
  await ensureStoreDir();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function seedDemoKnowledgeBaseIfNeeded(): Promise<KbArticleRecord[]> {
  if (!isDemoMode()) {
    return [];
  }

  const store = await readStore();
  if (store.articles.length > 0) {
    return store.articles;
  }

  const articles = seedDemoRecords();
  await writeStore({
    articles,
    seededAt: new Date().toISOString(),
  });
  return articles;
}

export async function listDemoKnowledgeBase(
  locale: AppLocale,
  params: KbSearchParams = {},
): Promise<KbListingResponse> {
  const articles = await seedDemoKnowledgeBaseIfNeeded();
  return searchDemoArticles(articles, locale, params);
}

export async function getDemoKnowledgeBaseTextForAi(
  locale: AppLocale,
  userQuery: string,
): Promise<string> {
  const articles = await seedDemoKnowledgeBaseIfNeeded();
  return buildDemoAiKnowledgeBaseText(articles, locale, userQuery);
}

/** Reset hook for future global demo reset — restores seed articles. */
export async function resetDemoKnowledgeBaseStore(): Promise<void> {
  if (!isDemoMode()) return;
  await writeStore({
    articles: seedDemoRecords(),
    seededAt: new Date().toISOString(),
  });
}

export async function createDemoArticleOverride(
  input: Omit<KbArticleRecord, "id" | "createdAt">,
): Promise<KbArticleRecord | null> {
  if (!isDemoMode()) return null;

  const store = await readStore();
  const articles =
    store.articles.length > 0 ? store.articles : seedDemoRecords();

  const record: KbArticleRecord = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await writeStore({
    ...store,
    articles: [...articles, record],
  });
  return record;
}

export function shouldUseDemoKnowledgeBase(): boolean {
  return isDemoMode();
}
