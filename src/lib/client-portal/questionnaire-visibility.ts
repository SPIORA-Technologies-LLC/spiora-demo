import type {
  QuestionDefinition,
  QuestionnaireAnswers,
  VisibilityOperator,
  VisibilityRule,
} from "./questionnaire-types";
import { isEmptyAnswer } from "./questionnaire-empty-values";

export function isQuestionVisible(
  question: QuestionDefinition,
  answers: QuestionnaireAnswers,
): boolean {
  if (!question.visibleWhen) return true;
  return evaluateVisibilityRule(question.visibleWhen, answers);
}

export function evaluateVisibilityRule(
  rule: VisibilityRule,
  answers: QuestionnaireAnswers,
): boolean {
  const current = answers[rule.questionId];
  const op = rule.operator;

  switch (op) {
    case "equals":
      return current === rule.value;
    case "notEquals":
      return current !== rule.value;
    case "isEmpty":
      return isEmptyAnswer(current);
    case "isNotEmpty":
      return !isEmptyAnswer(current);
    case "includes":
      if (!Array.isArray(current) || !Array.isArray(rule.value)) return false;
      return rule.value.every((v) => current.includes(v));
    default:
      return false;
  }
}

export function getVisibleQuestions(
  questions: Array<QuestionDefinition & { sectionId: string }>,
  answers: QuestionnaireAnswers,
): Array<QuestionDefinition & { sectionId: string }> {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

export type VisibilityPolicy = "keep_hidden_in_draft_ignore_in_validation";

/** Phase 1: hidden answers stay in draft but are ignored during validation. */
export const VISIBILITY_POLICY: VisibilityPolicy =
  "keep_hidden_in_draft_ignore_in_validation";
