import type {
  QuestionnaireAnswers,
  QuestionnaireSchema,
} from "./questionnaire-types";
import { normalizeCountryAnswers } from "./questionnaire-countries";

/**
 * Overlay derived display values (e.g. portal email) onto answers for UI/progress.
 * Also normalizes country free-text names to ISO codes for selects/validation.
 * Does not persist by itself — PATCH still rejects read-only/derived fields.
 */
export function hydrateDerivedAnswers(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
  ctx: { portalEmail: string },
): QuestionnaireAnswers {
  const next: QuestionnaireAnswers = normalizeCountryAnswers(schema, { ...answers });
  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (question.derivedFrom === "portal_email" && ctx.portalEmail) {
        next[question.id] = ctx.portalEmail;
      }
    }
  }
  return next;
}
