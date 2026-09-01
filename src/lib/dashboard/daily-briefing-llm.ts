import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppLocale } from "@/i18n/config";
import { isAiConfigured } from "@/lib/ai/config";
import { createChatCompletion } from "@/lib/ai/openai";
import { TEAM_AI_SYSTEM_TONE } from "@/lib/ai/tone";
import { getWorkspaceAiConfig } from "@/lib/ai/workspace-config";
import { branding } from "@/config/branding";
import type { DailyBriefingMetrics } from "@/lib/dashboard/daily-briefing";
import { getActivityDayKey } from "@/lib/presence/daily-activity-logic";
import { getAppState, setAppState } from "@/lib/supabase/app-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const APP_STATE_KEY = "command_center_daily_llm_cache";
const FILE_PATH = path.join(
  process.cwd(),
  ".data",
  "command-center-daily-llm-cache.json",
);

const TODAY_CACHE_TTL_MS = 30 * 60 * 1000;
const LLM_MAX_TOKENS = 420;

export type LlmDailySummarySource = "llm" | "none";

type CacheEntry = {
  text: string;
  cachedAt: string;
};

type LlmCacheStore = Record<string, CacheEntry>;

function cacheKey(dayKey: string, locale: AppLocale): string {
  return `${dayKey}:${locale}`;
}

function buildSystemPrompt(locale: AppLocale): string {
  if (locale === "ru") {
    return `${TEAM_AI_SYSTEM_TONE}

Ты пишешь короткую executive-сводку дня для Command Center (операционный обзор для руководителя relocation-команды).

Правила:
- Используй ТОЛЬКО числовые агрегаты из сообщения пользователя.
- Не выдумывай имена клиентов, суммы, встречи или события, которых нет в цифрах.
- Не упоминай JSON, поля или технические термины.
- 2–4 коротких абзаца, спокойный деловой тон.
- Если день был тихим — скажи об этом прямо.
- Если есть просроченные задачи или pending approval — выдели это как приоритет.`;
  }

  return `You are an AI colleague on ${branding.productName} (${branding.companyName}).

Write a short executive daily briefing for the Command Center (operations overview for a relocation agency team lead).

Rules:
- Use ONLY the numeric aggregates in the user message.
- Do not invent client names, amounts, meetings, or events not implied by the numbers.
- Do not mention JSON, field names, or technical terms.
- 2–4 short paragraphs, calm operational tone.
- If the day was quiet, say so clearly.
- If overdue tasks or pending approvals exist, call them out as priorities.`;
}

function buildUserPrompt(input: {
  dayKey: string;
  isToday: boolean;
  locale: AppLocale;
  metrics: DailyBriefingMetrics;
}): string {
  const dayLabel =
    input.locale === "ru"
      ? `День (Europe/Moscow): ${input.dayKey}. Сегодня: ${input.isToday ? "да" : "нет"}.`
      : `Day (Europe/Moscow): ${input.dayKey}. Is today: ${input.isToday ? "yes" : "no"}.`;

  return `${dayLabel}

Aggregates JSON:
${JSON.stringify(input.metrics, null, 2)}`;
}


async function readCacheStore(): Promise<LlmCacheStore> {
  if (isSupabaseConfigured()) {
    try {
      const value = await getAppState<LlmCacheStore>(APP_STATE_KEY);
      return value ?? {};
    } catch {
      return {};
    }
  }

  try {
    const raw = await readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as LlmCacheStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCacheStore(store: LlmCacheStore): Promise<void> {
  if (isSupabaseConfigured()) {
    await setAppState(APP_STATE_KEY, store);
    return;
  }

  await mkdir(path.dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function isCacheEntryFresh(
  entry: CacheEntry,
  dayKey: string,
  todayKey: string,
): boolean {
  if (dayKey !== todayKey) return true;
  const cachedAt = Date.parse(entry.cachedAt);
  if (Number.isNaN(cachedAt)) return false;
  return Date.now() - cachedAt < TODAY_CACHE_TTL_MS;
}

async function readCachedSummary(
  dayKey: string,
  locale: AppLocale,
  todayKey: string,
): Promise<string | null> {
  const store = await readCacheStore();
  const entry = store[cacheKey(dayKey, locale)];
  if (!entry?.text?.trim()) return null;
  if (!isCacheEntryFresh(entry, dayKey, todayKey)) return null;
  return entry.text.trim();
}

async function writeCachedSummary(
  dayKey: string,
  locale: AppLocale,
  text: string,
): Promise<void> {
  const store = await readCacheStore();
  store[cacheKey(dayKey, locale)] = {
    text: text.trim(),
    cachedAt: new Date().toISOString(),
  };
  await writeCacheStore(store);
}

export function isLlmDailySummaryAvailable(): boolean {
  return isAiConfigured();
}

export async function buildLlmDailySummary(input: {
  metrics: DailyBriefingMetrics;
  dayKey: string;
  locale: AppLocale;
  isToday?: boolean;
}): Promise<{ text: string | null; source: LlmDailySummarySource }> {
  if (!isAiConfigured()) {
    return { text: null, source: "none" };
  }

  const todayKey = getActivityDayKey();
  const isToday = input.isToday ?? input.dayKey === todayKey;

  const cached = await readCachedSummary(input.dayKey, input.locale, todayKey);
  if (cached) {
    return { text: cached, source: "llm" };
  }

  const workspaceConfig = getWorkspaceAiConfig();
  const text = await createChatCompletion(
    [
      { role: "system", content: buildSystemPrompt(input.locale) },
      {
        role: "user",
        content: buildUserPrompt({
          dayKey: input.dayKey,
          isToday,
          locale: input.locale,
          metrics: input.metrics,
        }),
      },
    ],
    {
      temperature: Math.min(workspaceConfig.temperature, 0.35),
      maxTokens: LLM_MAX_TOKENS,
      model: workspaceConfig.model,
    },
  );

  const normalized = text?.trim() ?? null;
  if (!normalized) {
    return { text: null, source: "none" };
  }

  await writeCachedSummary(input.dayKey, input.locale, normalized);
  return { text: normalized, source: "llm" };
}
