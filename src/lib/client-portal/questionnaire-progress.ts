import type {
  QuestionnaireAnswers,
  QuestionnaireSchema,
} from "./questionnaire-types";
import { DISPLAY_ONLY_TYPES } from "./questionnaire-types";
import { isEmptyAnswer } from "./questionnaire-empty-values";
import { flattenQuestions, getOrderedSections } from "./questionnaire-schema";
import { isQuestionVisible } from "./questionnaire-visibility";
import { CONSULTING_AGREEMENT_QUESTION_ID } from "./consulting-agreement-fields";

export type ProgressResult = {
  percent: number;
  completedRequired: number;
  totalRequired: number;
  sectionProgress: Record<
    string,
    { completed: number; total: number; percent: number }
  >;
};

export function calculateQuestionnaireProgress(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
): ProgressResult {
  const questions = flattenQuestions(schema);
  let completedRequired = 0;
  let totalRequired = 0;
  const sectionProgress: ProgressResult["sectionProgress"] = {};

  for (const section of getOrderedSections(schema)) {
    let secCompleted = 0;
    let secTotal = 0;

    for (const q of section.questions) {
      if (DISPLAY_ONLY_TYPES.has(q.type)) continue;
      if (q.readOnly || q.derivedFrom) continue;
      if (!isQuestionVisible(q, answers)) continue;
      if (!q.required) continue;

      secTotal++;
      totalRequired++;
      const val = answers[q.id];
      const filled =
        q.id === CONSULTING_AGREEMENT_QUESTION_ID
          ? val === true
          : !isEmptyAnswer(val);
      if (filled) {
        secCompleted++;
        completedRequired++;
      }
    }

    sectionProgress[section.id] = {
      completed: secCompleted,
      total: secTotal,
      percent: secTotal > 0 ? Math.round((secCompleted / secTotal) * 100) : 100,
    };
  }

  const percent =
    totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 0;

  return { percent, completedRequired, totalRequired, sectionProgress };
}

export function getFirstIncompleteSectionId(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
): string | null {
  const progress = calculateQuestionnaireProgress(schema, answers);
  for (const section of getOrderedSections(schema)) {
    const sp = progress.sectionProgress[section.id];
    if (sp && sp.total > 0 && sp.completed < sp.total) {
      return section.id;
    }
  }
  return null;
}
