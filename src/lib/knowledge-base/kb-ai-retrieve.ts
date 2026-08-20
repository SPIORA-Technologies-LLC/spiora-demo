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

const REQUIREMENT_QUERY =
  /(потребу|нужн|документ|требован|список|checklist|require|document|\bneed\b|\bneeds\b)/iu;

const REQUIREMENT_BLOCK =
  /(паспорт|справк|страхов|виз[аыуе]|schengen|шенген|доход|документ|passport|insurance|criminal|income|require)|^\s*[-•*]\s+/imu;

function isRequirementQuery(query: string): boolean {
  return REQUIREMENT_QUERY.test(query);
}

function scoreRequirementBlock(block: string, query: string): number {
  let score = scoreKbTextForAiQuery(block, query);
  if (isRequirementQuery(query) && REQUIREMENT_BLOCK.test(block)) {
    score += 8;
    // Prefer lists / bullet-heavy requirement sections.
    const bullets = (block.match(/^\s*[-•*]\s+/gm) ?? []).length;
    score += Math.min(bullets, 6);
  }
  return score;
}

/**
 * Build an AI excerpt that prefers query-relevant sections, not only the article lead.
 * Long client KB articles often put requirements lists after marketing intro text.
 */
export function excerptKbContentForAi(
  content: string,
  query: string,
  maxChars = 6000,
): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  const tokens = tokenizeKbAiQuery(query);
  const blocks = normalized
    .split(/\n{2,}|(?=^#{1,3}\s)/m)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length <= 1) {
    return `${normalized.slice(0, maxChars).trim()}…`;
  }

  const scored = blocks
    .map((block, index) => ({
      block,
      index,
      score: scoreRequirementBlock(block, query),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: Array<{ block: string; index: number }> = [];
  let used = 0;
  const preferRequirements = isRequirementQuery(query);
  const opening = blocks[0]!;
  const openingScore = scoreRequirementBlock(opening, query);

  const takeBlock = (block: string, index: number, softCap?: number) => {
    if (selected.some((item) => item.index === index)) return;
    let text = block;
    if (softCap && text.length > softCap) {
      text = `${text.slice(0, softCap).trim()}…`;
    }
    if (used + text.length + 2 > maxChars) {
      const room = maxChars - used - 2;
      if (room < 200) return;
      text = `${text.slice(0, room).trim()}…`;
    }
    selected.push({ block: text, index });
    used += text.length + 2;
  };

  if (preferRequirements) {
    for (const row of scored) {
      if (row.score <= 0) continue;
      takeBlock(row.block, row.index);
      if (selected.length >= 6 || used >= maxChars - 200) break;
    }
    // Short lead-in only if there is leftover budget.
    if (used < maxChars * 0.7 && openingScore >= 0) {
      takeBlock(opening, 0, 360);
    }
  } else {
    takeBlock(opening, 0, Math.min(opening.length, Math.floor(maxChars * 0.45)));
    for (const row of scored) {
      if (row.index === 0) continue;
      if (row.score <= 0 && selected.length >= 2) continue;
      takeBlock(row.block, row.index);
      if (selected.length >= 8) break;
    }
  }

  // If nothing useful selected, fall back to head of article.
  if (selected.length === 0) {
    return `${normalized.slice(0, maxChars).trim()}…`;
  }

  selected.sort((a, b) => a.index - b.index);
  const joined = selected.map((row) => row.block).join("\n\n").trim();
  return joined.length < normalized.length ? `${joined}\n\n…` : joined;
}
/** True when AI context is empty / placeholder rather than real article text. */
export function isEmptyKbAiContext(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return /unconfigured|не настроена|no matching|не найден|empty\.unconfigured|aiContextEmpty|\[kb_empty\]/i.test(
    trimmed,
  );
}
