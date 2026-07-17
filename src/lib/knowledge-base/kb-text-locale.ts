import type { AppLocale } from "@/i18n/config";
import { slugifyKbTitle } from "./kb-slug";

const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function isMostlyCyrillic(text: string): boolean {
  const cyr = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  return cyr > 0 && cyr >= lat;
}

export function transliterateCyrillicToLatin(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = CYR_TO_LAT[lower];
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    if (ch === lower) out += mapped;
    else out += mapped ? mapped[0]!.toUpperCase() + mapped.slice(1) : "";
  }
  return out.replace(/\s+/g, " ").trim();
}

function titleCaseLatin(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** English-facing title/topic from a possibly Russian prompt. */
export function englishFacingTopic(topic: string): string {
  if (!isMostlyCyrillic(topic)) return topic.trim() || "Internal workflow guide";
  const latin = transliterateCyrillicToLatin(topic);
  const titled = titleCaseLatin(latin);
  if (titled && /[A-Za-z]/.test(titled)) return titled;
  const fromSlug = slugifyKbTitle(topic);
  if (fromSlug !== "article") {
    return titleCaseLatin(fromSlug.replace(/-/g, " "));
  }
  return "Draft guide";
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
    ? `Draft guide generated from Russian topic: ${fields.title.slice(0, 100)}`
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
