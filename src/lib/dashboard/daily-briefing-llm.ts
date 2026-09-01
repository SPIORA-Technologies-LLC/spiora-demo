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
- Для подзаголовков секций используй отдельную строку вида **Заголовок** (без другого markdown).
- Если день был тихим — скажи об этом прямо.
- Если есть просроченные задачи или задачи на проверке — выдели это как приоритет.
- Пиши только по-русски. Не используй английские слова и латинские термины: intake, backlog, pending, approval, provider, contract и т.п.
- Вместо них используй: «заявка», «заявки на рассмотрении», «очередь задач», «на проверке», «ожидает подписи клиента/компании», «договор».`;
  }

  return `You are an AI colleague on ${branding.productName} (${branding.companyName}).

Write a short executive daily briefing for the Command Center (operations overview for a relocation agency team lead).

Rules:
- Use ONLY the numeric aggregates in the user message.
- Do not invent client names, amounts, meetings, or events not implied by the numbers.
- Do not mention JSON, field names, or technical terms.
- 2–4 short paragraphs, calm operational tone.
- Use standalone lines like **Section title** for section subheadings (no other markdown).
- If the day was quiet, say so clearly.
- If overdue tasks or pending approvals exist, call them out as priorities.`;
}

function formatLlmMetrics(
  metrics: DailyBriefingMetrics,
  locale: AppLocale,
): string {
  if (locale === "en") {
    return JSON.stringify(metrics, null, 2);
  }

  const lines = [
    `Встречи сегодня: ${metrics.eventsToday}`,
    `Встречи на неделе: ${metrics.eventsThisWeek}`,
    `Просроченные задачи: ${metrics.tasksOverdue}`,
    `Задачи на проверке: ${metrics.tasksPendingApproval}`,
    `Задач закрыто сегодня: ${metrics.tasksCompletedToday}`,
    `Задач создано сегодня: ${metrics.tasksCreatedToday}`,
    `Клиентов в CRM: ${metrics.clientsTotal}`,
    `Новых клиентов сегодня: ${metrics.clientsNewToday}`,
    `Ожидающих приглашений: ${metrics.invitationsPending}`,
    `Принято приглашений сегодня: ${metrics.invitationsAcceptedToday}`,
    `Заявок на рассмотрении: ${metrics.intakeCasesTotal}`,
    `Заявок подано сегодня: ${metrics.intakeSubmittedToday}`,
    `Сообщений в чате сегодня: ${metrics.chatMessagesToday}`,
    `AI-запросов сегодня: ${metrics.aiMessagesToday}`,
    `Документов всего: ${metrics.documentsTotal}`,
    `Документов загружено сегодня: ${metrics.documentsUploadedToday}`,
    `Договоров ждут подписи клиента: ${metrics.contractsAwaitingClientSignature}`,
    `Договоров ждут подписи компании: ${metrics.contractsAwaitingProviderSignature}`,
  ];

  if (metrics.financeTotalDebtCents != null) {
    lines.push(
      `Задолженность по договорам (евро): ${Math.round(metrics.financeTotalDebtCents / 100)}`,
      `Клиентов с задолженностью: ${metrics.financeClientsWithDebt ?? 0}`,
      `Клиентов без оплаты: ${metrics.financeClientsUnpaid ?? 0}`,
      `Клиентов с частичной оплатой: ${metrics.financeClientsPartial ?? 0}`,
    );
  }

  return lines.join("\n");
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

  const aggregatesLabel =
    input.locale === "ru" ? "Агрегаты дня:" : "Aggregates JSON:";

  return `${dayLabel}

${aggregatesLabel}
${formatLlmMetrics(input.metrics, input.locale)}`;
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
