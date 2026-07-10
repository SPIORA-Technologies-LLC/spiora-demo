import type { AppLocale } from "@/i18n/config";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";

export type OffTopicCategory =
  | "cooking"
  | "sports"
  | "astrology"
  | "homework"
  | "fiction"
  | "games"
  | "entertainment"
  | "jailbreak";

type OffTopicRule = {
  category: OffTopicCategory;
  patterns: RegExp[];
};

const OFF_TOPIC_RULES: OffTopicRule[] = [
  {
    category: "cooking",
    patterns: [
      /\b(recipe|cook(?:ing)?|bake|baking|kitchen)\b/i,
      /(рецепт|готовить|готовка|выпечк|кухн)/iu,
    ],
  },
  {
    category: "sports",
    patterns: [
      /\b(football|soccer|basketball|tennis|championship|match score)\b/i,
      /(футбол|баскетбол|теннис|спорт|матч|чемпионат)/iu,
    ],
  },
  {
    category: "astrology",
    patterns: [
      /\b(horoscope|zodiac|astrology|tarot)\b/i,
      /(гороскоп|зодиак|астролог|таро)/iu,
    ],
  },
  {
    category: "homework",
    patterns: [
      /\b(homework|algebra|calculus|solve this math)\b/i,
      /(домашн(?:ее|яя)\s+задани|алгебр|уравнени|реши\s+задач)/iu,
    ],
  },
  {
    category: "fiction",
    patterns: [
      /\b(write (?:me )?a (?:story|poem|novel)|creative fiction)\b/i,
      /(напиши\s+(?:мне\s+)?(?:рассказ|стих|повесть)|художественн)/iu,
    ],
  },
  {
    category: "games",
    patterns: [
      /\b(video game|fortnite|minecraft|playstation|xbox|cheat code)\b/i,
      /(видеоигр|форнайт|майнкрафт|playstation|xbox|чит\s+код)/iu,
    ],
  },
  {
    category: "entertainment",
    patterns: [
      /\b(netflix|movie review|tv series|celebrity gossip)\b/i,
      /(нетфликс|фильм|сериал|знаменитост)/iu,
    ],
  },
  {
    category: "jailbreak",
    patterns: [
      /\b(ignore (?:all )?previous|jailbreak|dan mode|developer mode|bypass safety)\b/i,
      /(игнорир(?:уй|овать)\s+(?:все\s+)?предыдущ|jailbreak|режим\s+разработчик|обойти\s+ограничени)/iu,
    ],
  },
];

const WORK_TOPIC_HINTS =
  /\b(client|crm|task|calendar|document|meeting|booking|formgrid|emigrant|клиент|задач|календар|документ|встреч|букинг|анкет|эмигрант)\b/iu;

export function detectOffTopicCategory(query: string): OffTopicCategory | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (WORK_TOPIC_HINTS.test(trimmed)) {
    return null;
  }

  for (const rule of OFF_TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return rule.category;
    }
  }

  return null;
}

export function buildOffTopicReply(
  locale: AppLocale,
  _category?: OffTopicCategory | null,
): string {
  return translateWorkspaceMessage(locale, "guardrails.offTopic");
}
