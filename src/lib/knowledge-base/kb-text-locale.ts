import type { AppLocale } from "@/i18n/config";
import { slugifyKbTitle } from "./kb-slug";

export function isMostlyCyrillic(text: string): boolean {
  const cyr = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  return cyr > 0 && cyr >= lat;
}

/** Multi-word Russian → English (checked first, longest / specific wins). */
const RU_WORD = "[\\u0400-\\u04FFA-Za-z0-9_]+";

const RU_EN_PHRASES: Array<{ re: RegExp; en: string }> = [
  { re: new RegExp(`корпоративн${RU_WORD}\\s+этик${RU_WORD}`, "i"), en: "Corporate Ethics" },
  { re: new RegExp(`рабоч${RU_WORD}\\s+этик${RU_WORD}`, "i"), en: "Work Ethics" },
  { re: new RegExp(`деловар?${RU_WORD}\\s+этик${RU_WORD}`, "i"), en: "Business Ethics" },
  {
    re: new RegExp(
      `здоров${RU_WORD}\\s+атмосфер${RU_WORD}.{0,40}коллектив${RU_WORD}`,
      "i",
    ),
    en: "Healthy Atmosphere in the Team",
  },
  {
    re: new RegExp(`атмосфер${RU_WORD}.{0,20}в\\s+коллектив${RU_WORD}`, "i"),
    en: "Team Atmosphere",
  },
  {
    re: new RegExp(`внутренн${RU_WORD}\\s+коммуникац${RU_WORD}`, "i"),
    en: "Internal Communication",
  },
  {
    re: new RegExp(`правил${RU_WORD}\\s+внутренн${RU_WORD}\\s+коммуникац${RU_WORD}`, "i"),
    en: "Internal Communication Guidelines",
  },
  { re: new RegExp(`политик${RU_WORD}\\s+компании`, "i"), en: "Company Policy" },
  {
    re: new RegExp(`онбординг${RU_WORD}\\s+сотрудник${RU_WORD}`, "i"),
    en: "Employee Onboarding",
  },
  {
    re: new RegExp(`адаптац${RU_WORD}\\s+сотрудник${RU_WORD}`, "i"),
    en: "Employee Onboarding",
  },
  { re: new RegExp(`управлен${RU_WORD}\\s+задач${RU_WORD}`, "i"), en: "Task Management" },
  { re: /безопасн\S*\s+данных/i, en: "Data Security" },
  { re: /работа\s+с\s+ai|работа\s+с\s+ии/i, en: "Working with AI" },
  {
    re: new RegExp(`эскалац${RU_WORD}\\s+процедур${RU_WORD}`, "i"),
    en: "Escalation Procedure",
  },
  {
    re: new RegExp(`ежемесячн${RU_WORD}\\s+отч[её]т${RU_WORD}`, "i"),
    en: "Monthly Reporting",
  },
  {
    re: new RegExp(`забота\\s+о\\s+здоровь${RU_WORD}\\s+сотрудник${RU_WORD}`, "i"),
    en: "Employee Health Care",
  },
];

/** Single-token glossary (lowercase keys). */
const RU_EN_WORDS: Record<string, string> = {
  корпоративная: "Corporate",
  корпоративный: "Corporate",
  корпоративные: "Corporate",
  этика: "Ethics",
  этики: "Ethics",
  этике: "Ethics",
  рабочая: "Work",
  рабочий: "Work",
  рабочие: "Work",
  деловая: "Business",
  деловой: "Business",
  здоровая: "Healthy",
  здоровый: "Healthy",
  здороваяя: "Healthy",
  атмосфера: "Atmosphere",
  атмосфере: "Atmosphere",
  атмосферы: "Atmosphere",
  коллектив: "Team",
  коллективе: "Team",
  коллектива: "Team",
  команда: "Team",
  команде: "Team",
  команды: "Team",
  сотрудник: "Employee",
  сотрудника: "Employee",
  сотрудники: "Employees",
  сотрудников: "Employees",
  политика: "Policy",
  политики: "Policy",
  компании: "Company",
  компания: "Company",
  клиент: "Client",
  клиента: "Client",
  клиенты: "Clients",
  клиентов: "Clients",
  документ: "Document",
  документы: "Documents",
  документов: "Documents",
  процесс: "Process",
  процессы: "Processes",
  задача: "Task",
  задачи: "Tasks",
  задач: "Tasks",
  безопасность: "Security",
  данных: "Data",
  данные: "Data",
  коммуникация: "Communication",
  коммуникации: "Communication",
  внутренняя: "Internal",
  внутренние: "Internal",
  внутренний: "Internal",
  правила: "Guidelines",
  правило: "Rule",
  руководство: "Guide",
  инструкция: "Guide",
  онбординг: "Onboarding",
  адаптация: "Onboarding",
  забота: "Care",
  здоровье: "Health",
  здоровьея: "Health",
  здоровьем: "Health",
  о: "for",
  в: "in",
  и: "and",
  с: "with",
  для: "for",
  по: "on",
};

function normalizeRuToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[«»""„]/g, "")
    .replace(/^[\s.,;:!?()[\]—–-]+|[\s.,;:!?()[\]—–-]+$/g, "");
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^(in|on|of|for|and|the|a|an|with|to)$/i.test(word)) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/^(in|on|of|for|and|the|a|an|with|to)\s/i, (m) =>
      m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
    );
}

/**
 * Translate a Russian topic into real English (not transliteration).
 * Uses phrase patterns first, then a word glossary; unknown tokens are skipped
 * rather than Latinized letter-by-letter.
 */
export function translateRussianTopicToEnglish(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) return "Internal workflow guide";

  for (const { re, en } of RU_EN_PHRASES) {
    if (re.test(trimmed)) return en;
  }

  const parts = trimmed.split(/(\s+)/);
  const translated: string[] = [];
  let hit = 0;

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      if (translated.length && translated[translated.length - 1] !== " ") {
        translated.push(" ");
      }
      continue;
    }
    const key = normalizeRuToken(part);
    if (!key) continue;
    const mapped = RU_EN_WORDS[key];
    if (mapped) {
      translated.push(mapped);
      hit += 1;
    }
  }

  const joined = translated.join("").replace(/\s+/g, " ").trim();
  if (hit > 0 && joined) {
    return titleCaseWords(joined);
  }

  // Fallback: descriptive English wrapper — never letter-transliterate.
  return "Internal guide";
}

/** @deprecated Prefer translateRussianTopicToEnglish — kept for rare slug helpers. */
export function transliterateCyrillicToLatin(text: string): string {
  return translateRussianTopicToEnglish(text);
}

/** English-facing title/topic from a possibly Russian prompt. */
export function englishFacingTopic(topic: string): string {
  const trimmed = topic.trim() || "Internal workflow guide";
  if (!isMostlyCyrillic(trimmed)) return trimmed;
  const translated = translateRussianTopicToEnglish(trimmed);
  if (translated && /[A-Za-z]/.test(translated)) return translated;
  const fromSlug = slugifyKbTitle(trimmed);
  if (fromSlug !== "article") {
    return titleCaseWords(fromSlug.replace(/-/g, " "));
  }
  return "Internal guide";
}

/** Russian-facing title/topic from a possibly English prompt. */
export function russianFacingTopic(topic: string): string {
  const trimmed = topic.trim() || "Внутреннее руководство";
  if (isMostlyCyrillic(trimmed)) return trimmed;
  return `Черновик: ${trimmed}`;
}

/**
 * When EN storage accidentally holds Cyrillic (AI draft / RU typed into EN),
 * present Latin/English-facing copy for EN UI without rewriting the DB.
 */
export function alignKbTextToLocale(
  locale: AppLocale,
  fields: { title: string; summary: string; content: string },
): { title: string; summary: string; content: string; corrected: boolean } {
  if (locale !== "en" || !isMostlyCyrillic(fields.title)) {
    return { ...fields, corrected: false };
  }

  const enTitle = englishFacingTopic(fields.title);
  const summary = isMostlyCyrillic(fields.summary)
    ? `Draft guide on: ${enTitle}`
    : fields.summary;

  let content = fields.content;
  if (isMostlyCyrillic(content)) {
    content = `## Overview\n\n${enTitle}\n\n## Notes\n\n- Source topic (RU): ${fields.title}\n- Replace this draft with a full English version before publishing.`;
  }

  return {
    title: enTitle,
    summary,
    content,
    corrected: true,
  };
}
