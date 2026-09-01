import "server-only";

import type { AppLocale } from "@/i18n/config";
import { branding } from "@/config/branding";
import type { ChatMessage } from "@/lib/ai/openai";
import { createChatCompletion, streamChatCompletion } from "@/lib/ai/openai";
import type { PortalChatTurn } from "@/lib/ai/client-portal-chat-types";
import {
  buildOffTopicReply,
  detectOffTopicCategory,
} from "@/lib/ai/workspace-off-topic";
import { shouldUseDemoResponsesOnly } from "@/lib/ai/workspace-demo-scenarios";
import { getWorkspaceAiConfig } from "@/lib/ai/workspace-config";
import { getKnowledgeBaseTextForAi } from "@/lib/knowledge-base/knowledge-base-service";
import { isEmptyKbAiContext } from "@/lib/knowledge-base/kb-ai-retrieve";

export type PortalAssistantResult = {
  reply: string;
  sources: string[];
  demo: boolean;
};

export type PortalAssistantStreamMeta = {
  sources: string[];
  demo: boolean;
};

const CLIENT_KB_WORK_HINTS =
  /\b(visa|immigration|passport|document|nomad|relocati|knowledge|viza|visa|внж|виза|паспорт|документ|релокац|переезд|анкет|программ|требован|digital\s*nomad|хорват|испан|португал|база\s*знан|база\s*данн)\b/iu;

function buildSystemPrompt(locale: AppLocale): string {
  if (locale === "ru") {
    return `Ты — помощник клиента в личном кабинете ${branding.productName} (${branding.companyName}).

Правила:
- Отвечай только по материалам из клиентской инфотеки, переданным в контексте.
- Если в контексте есть списки документов, требований или условий — перечисли их полностью, не сокращай и не говори, что списка нет.
- Не выдумывай факты, сроки, цены и требования, которых нет в контексте.
- Не запрашивай и не используй данные CRM, анкет других людей, внутренние заметки команды или корпоративную базу.
- Если в контексте действительно нет ответа — честно скажи об этом и предложи обратиться к специалисту ${branding.companyName}.
- Пиши по-русски, ясно и доброжелательно, на «вы». Короткие абзацы или списки.`;
  }

  return `You are a client assistant in the ${branding.productName} client portal (${branding.companyName}).

Rules:
- Answer only from the client infotheca materials provided in context.
- If the context includes document lists, requirements, or conditions, list them in full — do not say the list is missing.
- Do not invent facts, deadlines, prices, or requirements that are not in the context.
- Never use CRM data, other people's questionnaires, internal team notes, or the corporate knowledge base.
- If the context truly does not contain the answer, say so clearly and suggest contacting a ${branding.companyName} specialist.
- Write clearly and warmly. Prefer short paragraphs or lists.`;
}

function sourceLabel(locale: AppLocale): string {
  return locale === "ru"
    ? "Клиентская инфотека"
    : "Client Infotheca";
}

function emptyKbFallback(locale: AppLocale): string {
  return locale === "ru"
    ? "В клиентской инфотеке пока нет материалов по этому вопросу. Напишите вашему специалисту — он поможет уточнить детали."
    : "The client infotheca does not have material on this yet. Please contact your specialist for details.";
}

function buildDemoKbReply(
  locale: AppLocale,
  kbText: string,
): string {
  const snippet = kbText.replace(/\s+/g, " ").trim().slice(0, 700);
  if (locale === "ru") {
    return `По материалам клиентской инфотеки:\n\n${snippet}${
      kbText.length > 700 ? "…" : ""
    }\n\n_Демо-режим: подключите AI API-ключ для полноценных ответов._`;
  }
  return `From the client infotheca:\n\n${snippet}${
    kbText.length > 700 ? "…" : ""
  }\n\n_Demo mode: connect an AI API key for full answers._`;
}

function buildMessages(
  locale: AppLocale,
  kbText: string,
  history: PortalChatTurn[],
  userMessage: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `${buildSystemPrompt(locale)}\n\n=== CLIENT KNOWLEDGE BASE (scope=client only) ===\n${kbText}`,
    },
    ...history.slice(-8).map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    })),
    { role: "user", content: userMessage },
  ];
}

function getCompletionOptions() {
  const config = getWorkspaceAiConfig();
  return {
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    model: config.model,
  };
}

async function preparePortalRequest(
  userMessage: string,
  history: PortalChatTurn[],
  locale: AppLocale,
): Promise<
  | { kind: "empty" }
  | { kind: "direct"; reply: string; sources: string[]; demo?: boolean }
  | {
      kind: "ai";
      messages: ChatMessage[];
      sources: string[];
      trimmed: string;
      kbText: string;
    }
> {
  const trimmed = userMessage.trim();
  if (!trimmed) return { kind: "empty" };

  const offTopic =
    CLIENT_KB_WORK_HINTS.test(trimmed) ? null : detectOffTopicCategory(trimmed);
  if (offTopic) {
    return {
      kind: "direct",
      reply: buildOffTopicReply(locale, offTopic),
      sources: [],
      demo: true,
    };
  }

  let kbText: string;
  try {
    kbText = await getKnowledgeBaseTextForAi(locale, trimmed, "client");
  } catch (error) {
    console.error("[portal-ai] client KB load failed", error);
    kbText = "";
  }

  const hasUsefulKb = !isEmptyKbAiContext(kbText);

  if (!hasUsefulKb) {
    return {
      kind: "direct",
      reply: emptyKbFallback(locale),
      sources: [],
      demo: true,
    };
  }

  const sources = [sourceLabel(locale)];
  const messages = buildMessages(locale, kbText, history, trimmed);
  return { kind: "ai", messages, sources, trimmed, kbText };
}

export async function runPortalAssistant(
  userMessage: string,
  history: PortalChatTurn[] = [],
  locale: AppLocale = "en",
): Promise<PortalAssistantResult> {
  const prepared = await preparePortalRequest(userMessage, history, locale);

  if (prepared.kind === "empty") {
    return {
      reply:
        locale === "ru"
          ? "Напишите вопрос — я отвечу по материалам клиентской инфотеки."
          : "Ask a question and I will answer from the client infotheca.",
      sources: [],
      demo: true,
    };
  }

  if (prepared.kind === "direct") {
    return {
      reply: prepared.reply,
      sources: prepared.sources,
      demo: prepared.demo ?? false,
    };
  }

  if (shouldUseDemoResponsesOnly()) {
    return {
      reply: buildDemoKbReply(locale, prepared.kbText),
      sources: prepared.sources,
      demo: true,
    };
  }

  const aiReply = await createChatCompletion(
    prepared.messages,
    getCompletionOptions(),
  );

  if (aiReply) {
    return {
      reply: aiReply,
      sources: prepared.sources,
      demo: false,
    };
  }

  return {
    reply: buildDemoKbReply(locale, prepared.kbText),
    sources: prepared.sources,
    demo: true,
  };
}

export async function* runPortalAssistantStream(
  userMessage: string,
  history: PortalChatTurn[] = [],
  locale: AppLocale = "en",
): AsyncGenerator<string | PortalAssistantStreamMeta> {
  const prepared = await preparePortalRequest(userMessage, history, locale);

  if (prepared.kind === "empty") {
    yield { sources: [], demo: true };
    yield locale === "ru"
      ? "Напишите вопрос — я отвечу по материалам клиентской инфотеки."
      : "Ask a question and I will answer from the client infotheca.";
    return;
  }

  if (prepared.kind === "direct") {
    yield {
      sources: prepared.sources,
      demo: prepared.demo ?? false,
    };
    yield prepared.reply;
    return;
  }

  if (shouldUseDemoResponsesOnly()) {
    yield { sources: prepared.sources, demo: true };
    yield buildDemoKbReply(locale, prepared.kbText);
    return;
  }

  yield { sources: prepared.sources, demo: false };

  let hasContent = false;
  for await (const chunk of streamChatCompletion(
    prepared.messages,
    getCompletionOptions(),
  )) {
    hasContent = true;
    yield chunk;
  }

  if (!hasContent) {
    yield { sources: prepared.sources, demo: true };
    yield buildDemoKbReply(locale, prepared.kbText);
  }
}
