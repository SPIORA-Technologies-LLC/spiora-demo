import type { QuestionDefinition, QuestionnaireAnswers } from "./questionnaire-types";
import { DISPLAY_ONLY_TYPES } from "./questionnaire-types";
import { isQuestionVisible } from "./questionnaire-visibility";

type ReviewQuestion = {
  id: string;
  type: QuestionDefinition["type"] | string;
  order?: number;
  label: { en: string; ru: string };
  options?: QuestionDefinition["options"];
  visibleWhen?: QuestionDefinition["visibleWhen"];
};
type ReviewSchema = {
  sections: Array<{
    id: string;
    order?: number;
    title: { en: string; ru: string };
    questions: ReviewQuestion[];
  }>;
};

function countryLabel(code: string, locale: "en" | "ru"): string {
  try {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return names.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export function formatAnswerForReview(
  question: ReviewQuestion,
  value: unknown,
  locale: "en" | "ru",
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (question.type === "boolean" && typeof value === "boolean") {
    return value ? (locale === "ru" ? "Да" : "Yes") : (locale === "ru" ? "Нет" : "No");
  }
  if ((question.type === "multiselect" || question.type === "checkbox") && Array.isArray(value)) {
    const labels = value.map((item) => {
      const opt = question.options?.find((o) => o.value === item);
      return opt ? opt.label[locale] : String(item);
    });
    return labels.length > 0 ? labels.join(", ") : "—";
  }
  if ((question.type === "select" || question.type === "radio") && typeof value === "string") {
    const opt = question.options?.find((o) => o.value === value);
    return opt ? opt.label[locale] : value;
  }
  if (question.type === "country" && typeof value === "string") {
    return countryLabel(value, locale);
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "—";
}

export function buildReviewSections(
  schema: ReviewSchema,
  answers: QuestionnaireAnswers,
  locale: "en" | "ru",
) {
  const orderedSections = [...schema.sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  return orderedSections.map((section) => ({
    id: section.id,
    title: section.title[locale],
    items: section.questions
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((q) => !DISPLAY_ONLY_TYPES.has(q.type as QuestionDefinition["type"]))
      .filter((q) => isQuestionVisible(q as QuestionDefinition, answers))
      .map((q) => ({
        questionId: q.id,
        label: q.label[locale],
        value: formatAnswerForReview(q, answers[q.id], locale),
      })),
  }));
}
