import type {
  QuestionDefinition,
  QuestionnaireSchema,
} from "./questionnaire-types";

/** Crypto-free helpers safe for client bundles. */
export function flattenQuestions(
  schema: QuestionnaireSchema,
): Map<string, QuestionDefinition & { sectionId: string }> {
  const map = new Map<string, QuestionDefinition & { sectionId: string }>();
  for (const section of schema.sections) {
    for (const question of section.questions) {
      map.set(question.id, { ...question, sectionId: section.id });
    }
  }
  return map;
}
