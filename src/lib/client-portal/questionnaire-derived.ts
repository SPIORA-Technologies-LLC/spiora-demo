import type {
  QuestionnaireAnswers,
  QuestionnaireSchema,
} from "./questionnaire-types";

/**
 * Overlay derived display values (e.g. portal email) onto answers for UI/progress.
 * Does not persist — PATCH still rejects read-only/derived fields.
 */
export function hydrateDerivedAnswers(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
  ctx: { portalEmail: string },
): QuestionnaireAnswers {
  const next: QuestionnaireAnswers = { ...answers };
  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (question.derivedFrom === "portal_email" && ctx.portalEmail) {
        next[question.id] = ctx.portalEmail;
      }
    }
  }
  return next;
}
