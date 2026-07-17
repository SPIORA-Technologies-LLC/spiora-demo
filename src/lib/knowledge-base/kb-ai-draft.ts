import type { AppLocale } from "@/i18n/config";
import { slugifyKbTitle } from "./kb-slug";
import {
  englishFacingTopic,
  isMostlyCyrillic,
  russianFacingTopic,
} from "./kb-text-locale";
import type { KbCategoryId } from "./types";

export type KbAiDraftResult = {
  slug: string;
  categoryId: KbCategoryId;
  tagKeys: string[];
  authorKey: string;
  translations: {
    en: { title: string; summary: string; content: string };
    ru: { title: string; summary: string; content: string };
  };
};

function inferCategory(prompt: string): KbCategoryId {
  const hay = prompt.toLowerCase();
  if (/crm|client|клиент|intake|onboarding/i.test(hay)) return "client-workflow";
  if (/document|документ|шаблон|template/i.test(hay)) return "document-management";
  if (/team|сотрудник|onboarding|адаптац/i.test(hay)) return "team-onboarding";
  if (/ai|automation|автомат/i.test(hay)) return "ai-automation";
  return "company-policies";
}

function inferTags(prompt: string): string[] {
  const tags = new Set<string>(["workflow"]);
  const hay = prompt.toLowerCase();
  if (/crm|client|клиент/i.test(hay)) tags.add("clients");
  if (/document|документ/i.test(hay)) tags.add("documents");
  if (/ai/i.test(hay)) tags.add("ai");
  if (/compliance|policy|политик|этик/i.test(hay)) tags.add("compliance");
  return [...tags].slice(0, 4);
}

function buildMarkdown(topic: string, locale: AppLocale): string {
  if (locale === "ru") {
    return `## Обзор

${topic}

## Шаги

1. Определите цель и аудиторию процесса.
2. Зафиксируйте входные данные и ожидаемый результат.
3. Опишите пошаговый сценарий для команды.
4. Добавьте контрольные точки и ответственных.

## Примечания

- Проверьте актуальность ссылок на CRM и базу знаний.
- Обновите статью после изменения процесса.`;
  }

  return `## Overview

${topic}

## Steps

1. Define the goal and audience for this process.
2. Capture required inputs and expected outcomes.
3. Document the step-by-step workflow for the team.
4. Add checkpoints and ownership.

## Notes

- Verify CRM and Knowledge Base references stay current.
- Update this article when the process changes.`;
}

function clip(title: string): string {
  return title.length > 80 ? `${title.slice(0, 77)}…` : title;
}

/** Demo-safe KB draft generator (no external AI required). */
export function generateKbAiDraft(
  prompt: string,
  authorKey = "olivia-bennett",
): KbAiDraftResult {
  const trimmed = prompt.trim();
  const topic = trimmed || "Internal workflow guide";
  const enTopic = englishFacingTopic(topic);
  const ruTopic = russianFacingTopic(topic);
  const enTitle = clip(enTopic);
  const ruTitle = clip(ruTopic);

  return {
    slug: slugifyKbTitle(enTitle),
    categoryId: inferCategory(topic),
    tagKeys: inferTags(topic),
    authorKey,
    translations: {
      en: {
        title: enTitle,
        summary: isMostlyCyrillic(topic)
          ? `Draft guide generated from Russian topic: ${topic.slice(0, 100)}`
          : `Draft guide generated from: ${topic.slice(0, 120)}`,
        content: buildMarkdown(enTopic, "en"),
      },
      ru: {
        title: ruTitle,
        summary: `Черновик инструкции на основе запроса: ${topic.slice(0, 120)}`,
        content: buildMarkdown(ruTopic, "ru"),
      },
    },
  };
}
