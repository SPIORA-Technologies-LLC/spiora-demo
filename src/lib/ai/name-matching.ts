import { extractSearchTokens } from "@/lib/ai/client-search";
import { morphNameMatch } from "@/lib/ai/russian-name-morphology";

const STOP_WORDS = new Set([
  "из",
  "наш",
  "нашего",
  "нашей",
  "наше",
  "нашим",
  "приложения",
  "приложение",
  "пложения",
  "emigrant",
  "desk",
  "croatia",
  "проверь",
  "проверить",
  "покажи",
  "найди",
  "суммируй",
  "суммировать",
  "какой",
  "какая",
  "какие",
  "какое",
  "каких",
  "какому",
  "каким",
  "еще",
  "ещё",
  "других",
  "другие",
  "другой",
  "проблема",
  "проблемы",
  "договор",
  "договора",
  "договорами",
  "договоров",
  "подписать",
  "подпис",
  "нужно",
  "надо",
  "номер",
  "номера",
  "номеру",
  "текущий",
  "текущая",
  "текущее",
  "статус",
  "статуса",
  "статусе",
  "клиент",
  "клиента",
  "клиентка",
  "клиентки",
  "клиенту",
  "клиентов",
  "дело",
  "дела",
  "обстоят",
  "обстоит",
  "обстоять",
  "как",
  "кабинет",
  "кабинете",
  "таблица",
  "таблице",
  "есть",
  "нет",
  "где",
  "что",
  "кто",
  "кого",
  "кому",
  "для",
  "про",
  "при",
  "или",
  "это",
  "этот",
  "эта",
  "эти",
  "новая",
  "новые",
  "новую",
  "новых",
  "анкета",
  "анкеты",
  "анкету",
  "анкет",
  "заявка",
  "заявки",
  "заявку",
  "заявок",
  "неделя",
  "недели",
  "неделю",
  "неделе",
  "сегодня",
  "вчера",
  "завтра",
  "intake",
  "questionnaire",
  "паспорт",
  "паспорта",
  "паспорту",
  "паспортом",
  "паспорте",
  "passport",
]);

const NAME_FIELD_NOISE =
  /^(?:паспорт(?:а|у|ом|е)?|номер(?:а|у|ом)?|passport|number|email|phone|address|адрес(?:а|у|ом)?|телефон(?:а|у|ом)?|гражданств(?:о|а|e)?|citizenship)$/iu;

/** Имя/фамилия из естественных фраз («клиентка Калашниковой», «по Ирине …»). */
export function extractPersonNameTokens(query: string): string[] {
  return extractSearchTokens(query).filter((token) => !STOP_WORDS.has(token));
}

export function extractMeaningfulPersonNameTokens(query: string): string[] {
  return extractPersonNameTokens(query).filter(
    (token) => !NAME_FIELD_NOISE.test(token),
  );
}

export function tokenizeSearchQuery(query: string): string[] {
  return extractPersonNameTokens(query);
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return i;
}

function wordVariants(word: string): string[] {
  const variants = new Set([word]);
  if (word.length > 4) variants.add(word.slice(0, -1));
  if (word.length > 5) variants.add(word.slice(0, -2));
  return [...variants];
}

/** Учитывает падежи, но не путает похожие фамилии (Белоногова ≠ Белоусова). */
export function namePartMatches(token: string, part: string): boolean {
  const t = token.toLowerCase().trim();
  const p = part.toLowerCase().trim();
  if (!t || !p) return false;
  if (t === p) return true;

  const shorter = t.length <= p.length ? t : p;
  const longer = t.length <= p.length ? p : t;
  if (shorter.length >= 5 && longer.includes(shorter)) return true;

  for (const tv of wordVariants(t)) {
    for (const pv of wordVariants(p)) {
      if (tv === pv) return true;
      const prefix = commonPrefixLength(tv, pv);
      const minLen = Math.min(tv.length, pv.length);
      const required = Math.max(5, minLen - 2);
      if (prefix >= required) return true;
    }
  }

  return false;
}

/** Ищет совпадения по словам в произвольной строке (ФИО, латиница, заметки). */
export function scoreNameInText(text: string, tokens: string[]): number {
  if (!text.trim() || tokens.length === 0) return 0;

  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

  const matched = tokens.filter((token) =>
    words.some((word) => morphNameMatch(token, word) || namePartMatches(token, word)),
  );

  return matched.length * 12;
}

export function scorePersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  tokens: string[],
): number {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (tokens.length === 0 || (!first && !last)) return 0;

  let score = 0;
  let matchedFirst = false;
  let matchedLast = false;

  for (const token of tokens) {
    if (first && morphNameMatch(token, first)) {
      if (!matchedFirst) score += 12;
      matchedFirst = true;
    }
    if (last && morphNameMatch(token, last)) {
      if (!matchedLast) score += 12;
      matchedLast = true;
    }
  }

  if (matchedFirst && matchedLast && tokens.length >= 2) {
    score += 8;
  }

  if (score === 0 && (first || last)) {
    return scoreNameInText([first, last].filter(Boolean).join(" "), tokens);
  }

  return score;
}
