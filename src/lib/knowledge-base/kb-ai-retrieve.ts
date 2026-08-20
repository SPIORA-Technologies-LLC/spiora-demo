/**
 * Retrieval helpers for feeding knowledge-base articles into AI assistants.
 * Uses ranked OR matching (not strict AND on every question word).
 */

const KB_AI_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "from",
  "with",
  "about",
  "what",
  "which",
  "when",
  "where",
  "who",
  "how",
  "why",
  "will",
  "need",
  "needed",
  "require",
  "required",
  "please",
  "tell",
  "show",
  "give",
  "ask",
  "me",
  "my",
  "your",
  "into",
  "onto",
  "и",
  "а",
  "но",
  "или",
  "для",
  "про",
  "при",
  "из",
  "от",
  "до",
  "по",
  "на",
  "в",
  "во",
  "к",
  "ко",
  "со",
  "об",
  "что",
  "кто",
  "как",
  "где",
  "когда",
  "какой",
  "какая",
  "какие",
  "какое",
  "каких",
  "нужно",
  "нужны",
  "нужна",
  "потребуется",
  "потребуются",
  "требуется",
  "требуются",
  "расскажи",
  "скажи",
  "покажи",
  "найди",
  "есть",
  "нет",
  "это",
  "этот",
  "эта",
  "эти",
  "информация",
  "информацию",
  "вопрос",
  "пожалуйста",
]);

export function tokenizeKbAiQuery(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !KB_AI_STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
  return [...new Set(tokens)].slice(0, 12);
}

function tokenMatchesHaystack(token: string, haystack: string): boolean {
  if (haystack.includes(token)) return true;
  // Light stemming for RU/EN inflections (визы→виза, documents→document).
  for (const cut of [1, 2, 3]) {
    if (token.length < 4 + cut) continue;
    const stem = token.slice(0, -cut);
    if (stem.length >= 3 && haystack.includes(stem)) return true;
  }
  return false;
}

export function scoreKbTextForAiQuery(text: string, query: string): number {
  const tokens = tokenizeKbAiQuery(query);
  if (tokens.length === 0) return 0;
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (tokenMatchesHaystack(token, haystack)) {
      score += token.length >= 6 ? 3 : 2;
    }
  }
  return score;
}

export type KbAiCandidate = {
  slug: string;
  title: string;
  categoryLabel: string;
  summary: string;
  content: string;
};

export function rankKbArticlesForAi(
  articles: KbAiCandidate[],
  query: string,
  limit = 8,
): KbAiCandidate[] {
  const tokens = tokenizeKbAiQuery(query);
  if (tokens.length === 0) {
    return articles.slice(0, limit);
  }

  const ranked = articles
    .map((article) => {
      const haystack = [
        article.title,
        article.summary,
        article.categoryLabel,
        article.content,
      ].join(" ");
      return {
        article,
        score: scoreKbTextForAiQuery(haystack, query),
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));

  return ranked.slice(0, limit).map((row) => row.article);
}

/** True when AI context is empty / placeholder rather than real article text. */
export function isEmptyKbAiContext(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return /unconfigured|не настроена|no matching|не найден|empty\.unconfigured|aiContextEmpty|\[kb_empty\]/i.test(
    trimmed,
  );
}
