import type { AppLocale } from "@/i18n/config";
import { translateCalendarMessage } from "@/i18n/calendar-enums";
import { displayClientName } from "@/lib/clients/display-name";
import { isMostlyCyrillic } from "@/lib/knowledge-base/kb-text-locale";

export const DEMO_EVENT_TITLE_PREFIX = "demo:";

export function isDemoEventTitle(title: string): boolean {
  return title.startsWith(DEMO_EVENT_TITLE_PREFIX);
}

export function buildDemoEventTitle(titleKey: string): string {
  return `${DEMO_EVENT_TITLE_PREFIX}${titleKey}`;
}

const EVENT_RU_EN_PHRASES: Array<{ re: RegExp; en: string }> = [
  { re: /тестируем\s+вид\S*/i, en: "Testing the view" },
  { re: /тестирован\S*/i, en: "Testing" },
  { re: /тестируем\S*/i, en: "Testing" },
  { re: /видео\s*звон\S*/i, en: "Video call" },
  { re: /видеозвон\S*/i, en: "Video call" },
  { re: /созвон\S*/i, en: "Call" },
  { re: /консультац\S*/i, en: "Consultation" },
  { re: /встреч\S*/i, en: "Meeting" },
  { re: /звон\S*/i, en: "Call" },
];

const EVENT_RU_EN_WORDS: Record<string, string> = {
  тестирование: "Testing",
  тестируем: "Testing",
  тестировать: "Testing",
  тест: "Test",
  вид: "view",
  вида: "view",
  виде: "view",
  видео: "Video",
  звонок: "Call",
  звонка: "Call",
  звонки: "Calls",
  встреча: "Meeting",
  встречи: "Meeting",
  встречу: "Meeting",
  созвон: "Call",
  консультация: "Consultation",
  консультации: "Consultation",
  клиент: "Client",
  клиента: "Client",
  команда: "Team",
  команды: "Team",
  синк: "Sync",
  демо: "Demo",
};

function stripTrailingEllipsis(title: string): {
  core: string;
  ellipsis: string;
} {
  const match = title.match(/(\s*(?:\.{2,}|…))$/);
  if (!match) return { core: title.trim(), ellipsis: "" };
  return {
    core: title.slice(0, -match[1].length).trim(),
    ellipsis: match[1].includes("…") ? "…" : "...",
  };
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && /^(in|on|of|for|and|the|a|an|with|to)$/i.test(word)) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Display-facing English for a free-text Russian calendar title.
 * Prefers real English glosses; unknown tokens are Latinized.
 */
export function translateRussianEventTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;

  const { core, ellipsis } = stripTrailingEllipsis(trimmed);

  for (const { re, en } of EVENT_RU_EN_PHRASES) {
    if (re.test(core)) {
      return `${en}${ellipsis}`;
    }
  }

  const parts = core.split(/(\s+)/);
  const out: string[] = [];
  let glossaryHits = 0;

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      out.push(" ");
      continue;
    }
    const key = part
      .toLowerCase()
      .replace(/[«»""„]/g, "")
      .replace(/^[\s.,;:!?()[\]—–-]+|[\s.,;:!?()[\]—–-]+$/g, "");
    const mapped = key ? EVENT_RU_EN_WORDS[key] : undefined;
    if (mapped) {
      out.push(mapped);
      glossaryHits += 1;
    } else if (/[А-Яа-яЁё]/.test(part)) {
      out.push(displayClientName(part, "en"));
    } else {
      out.push(part);
    }
  }

  const joined = out.join("").replace(/\s+/g, " ").trim();
  if (!joined) {
    return `${displayClientName(trimmed, "en")}`;
  }

  const english =
    glossaryHits > 0 ? titleCaseWords(joined) : displayClientName(trimmed, "en");
  if (glossaryHits > 0 && ellipsis) {
    return `${english}${ellipsis}`;
  }
  return english;
}

export function resolveCalendarEventTitle(
  title: string,
  locale: AppLocale,
): string {
  if (isDemoEventTitle(title)) {
    const key = title.slice(DEMO_EVENT_TITLE_PREFIX.length);
    const translated = translateCalendarMessage(
      locale,
      `calendar.demoEvents.${key}`,
    );
    if (translated === `calendar.demoEvents.${key}`) {
      return title;
    }
    return translated;
  }

  if (locale === "en" && isMostlyCyrillic(title)) {
    return translateRussianEventTitle(title);
  }

  return title;
}
