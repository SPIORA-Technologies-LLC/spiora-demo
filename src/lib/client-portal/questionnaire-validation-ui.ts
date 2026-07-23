import type {
  QuestionnaireAnswers,
  QuestionnaireSchema,
  ValidationErrorItem,
} from "./questionnaire-types";
import { flattenQuestions } from "./questionnaire-flatten";
import { validateAnswersAgainstSchema } from "./questionnaire-validation";

export const QUESTIONNAIRE_VALIDATION_SESSION_KEY =
  "spiora.client.questionnaire.validation.v1";

export type StoredValidationSession = {
  errors: ValidationErrorItem[];
  focusQuestionId: string | null;
  gateActive: boolean;
};

export function orderValidationErrors(
  schema: QuestionnaireSchema,
  errors: ValidationErrorItem[],
): ValidationErrorItem[] {
  const questions = flattenQuestions(schema);
  const order = new Map<string, number>();
  let index = 0;
  for (const [questionId] of questions) {
    order.set(questionId, index);
    index += 1;
  }
  return [...errors].sort((a, b) => {
    const ai = order.get(a.questionId) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.questionId) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.questionId.localeCompare(b.questionId);
  });
}

export function getNextValidationError(
  schema: QuestionnaireSchema,
  errors: ValidationErrorItem[],
  currentQuestionId: string | null,
): ValidationErrorItem | null {
  const ordered = orderValidationErrors(schema, errors).filter(
    (error) => !error.questionId.startsWith("_"),
  );
  if (ordered.length === 0) return null;
  if (!currentQuestionId) return ordered[0] ?? null;
  const currentIndex = ordered.findIndex(
    (error) => error.questionId === currentQuestionId,
  );
  if (currentIndex < 0) return ordered[0] ?? null;
  return ordered[(currentIndex + 1) % ordered.length] ?? null;
}

export function revalidateAnswersLocally(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
  locale: "en" | "ru",
): ValidationErrorItem[] {
  return orderValidationErrors(
    schema,
    validateAnswersAgainstSchema(schema, answers, locale),
  );
}

export function fieldLabelFromSchema(
  schema: QuestionnaireSchema,
  questionId: string,
  locale: "en" | "ru",
): string {
  const questions = flattenQuestions(schema);
  const question = questions.get(questionId);
  if (!question) return questionId;
  return question.label[locale] || question.label.en || questionId;
}

export function buildSectionFocusHref(
  sectionId: string,
  questionId: string,
): string {
  const params = new URLSearchParams({ focus: questionId });
  return `/client/questionnaire/${encodeURIComponent(sectionId)}?${params.toString()}`;
}

export function readFocusQuestionIdFromSearch(
  search: string,
): string | null {
  try {
    const value = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    ).get("focus");
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writeValidationSession(
  session: StoredValidationSession,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(QUESTIONNAIRE_VALIDATION_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

export function readValidationSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage,
): StoredValidationSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(QUESTIONNAIRE_VALIDATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredValidationSession;
    if (!parsed || !Array.isArray(parsed.errors)) return null;
    return {
      errors: parsed.errors,
      focusQuestionId:
        typeof parsed.focusQuestionId === "string" ? parsed.focusQuestionId : null,
      gateActive: Boolean(parsed.gateActive),
    };
  } catch {
    return null;
  }
}

export function clearValidationSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(QUESTIONNAIRE_VALIDATION_SESSION_KEY);
  } catch {
    // ignore
  }
}
