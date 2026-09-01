import { normalizeComparable } from "@/lib/ai/search-normalize";

export type IntakeReviewField = {
  questionId: string;
  label: string;
  value: string;
  sectionTitle?: string;
};

const FIELD_HINT_STOP_WORDS = new Set([
  "какой",
  "какая",
  "какие",
  "какое",
  "сколько",
  "когда",
  "где",
  "что",
  "кто",
  "у",
  "клиент",
  "клиента",
  "клиенту",
  "скажи",
  "дай",
  "покажи",
  "напиши",
  "есть",
  "ли",
  "the",
  "what",
  "which",
  "when",
  "where",
  "tell",
  "show",
  "give",
]);

export function collectIntakeReviewFields(
  detail: {
    reviewSections: Array<{
      title: string;
      items: Array<{ questionId: string; label: string; value: string }>;
    }>;
    record: { email?: string | null; phone?: string | null };
  },
): IntakeReviewField[] {
  const fields: IntakeReviewField[] = [];

  for (const section of detail.reviewSections) {
    for (const item of section.items) {
      if (!item.value || item.value === "—") continue;
      fields.push({
        questionId: item.questionId,
        label: item.label.trim(),
        value: item.value.trim(),
        sectionTitle: section.title,
      });
    }
  }

  if (detail.record.email?.trim() && detail.record.email !== "—") {
    fields.push({
      questionId: "email",
      label: "Email",
      value: detail.record.email.trim(),
    });
  }
  if (detail.record.phone?.trim() && detail.record.phone !== "—") {
    fields.push({
      questionId: "phone",
      label: "Телефон",
      value: detail.record.phone.trim(),
    });
  }

  return fields;
}

export function extractFieldHint(query: string, nameTokens: string[]): string {
  const nameSet = new Set(nameTokens.map((token) => token.toLowerCase()));
  return query
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 2 &&
        !FIELD_HINT_STOP_WORDS.has(word) &&
        !nameSet.has(word),
    )
    .join(" ")
    .trim();
}

function scoreFieldAgainstHint(
  field: IntakeReviewField,
  hint: string,
  query: string,
): number {
  if (!hint) return 0;

  const label = field.label.toLowerCase().replace(/ё/g, "е");
  const labelComparable = normalizeComparable(label);
  const hintComparable = normalizeComparable(hint);
  const queryLower = query.toLowerCase().replace(/ё/g, "е");
  let score = 0;

  if (hint.length >= 3 && label.includes(hint)) score += 24;
  if (hintComparable.length >= 3 && labelComparable.includes(hintComparable)) {
    score += 20;
  }
  if (hint.length >= 3 && queryLower.includes(label)) score += 18;

  const hintTokens = hint.split(/\s+/).filter((token) => token.length >= 3);
  for (const token of hintTokens) {
    if (label.includes(token)) score += 10;
    const tokenComparable = normalizeComparable(token);
    if (
      tokenComparable.length >= 3 &&
      labelComparable.includes(tokenComparable)
    ) {
      score += 8;
    }
    if (field.questionId.toLowerCase().includes(token)) score += 6;
  }

  return score;
}

export function rankIntakeFieldsForQuery(
  query: string,
  fields: IntakeReviewField[],
  nameTokens: string[],
): Array<IntakeReviewField & { score: number }> {
  const hint = extractFieldHint(query, nameTokens);
  return fields
    .map((field) => ({
      ...field,
      score: scoreFieldAgainstHint(field, hint, query),
    }))
    .filter((entry) => entry.score >= 8)
    .sort((a, b) => b.score - a.score);
}

export function asksIntakeFieldLookup(query: string): boolean {
  return /(?:какой|какая|какие|какое|сколько|когда|где|что|как|скажи|дай|покажи|напиши|what|which|when|where|how)/iu.test(
    query,
  );
}
