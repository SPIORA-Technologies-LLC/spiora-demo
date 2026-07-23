import type {
  QuestionDefinition,
  QuestionnaireSchema,
  SectionDefinition,
} from "./questionnaire-types";
import {
  ANSWERABLE_TYPES,
  DISPLAY_ONLY_TYPES,
  QUESTIONNAIRE_LIMITS,
} from "./questionnaire-types";
import { canonicalizeJson } from "./questionnaire-schema-hash";
import { flattenQuestions } from "./questionnaire-flatten";

export {
  canonicalizeJson,
  hashCanonicalJson,
  hashQuestionnaireSchema,
  GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH,
  GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH_LEGACY,
} from "./questionnaire-schema-hash";

export { flattenQuestions } from "./questionnaire-flatten";

/** @deprecated Prefer canonicalizeJson — kept for existing call sites. */
export function canonicalizeSchema(schema: QuestionnaireSchema): string {
  return canonicalizeJson(schema);
}

export function getOrderedSections(
  schema: QuestionnaireSchema,
): SectionDefinition[] {
  return [...schema.sections].sort((a, b) => a.order - b.order);
}

export function validateSchemaStructure(
  schema: unknown,
): { ok: true; schema: QuestionnaireSchema } | { ok: false; code: string } {
  if (!schema || typeof schema !== "object") {
    return { ok: false, code: "INVALID_ROOT" };
  }
  const s = schema as QuestionnaireSchema;
  if (s.schemaVersion !== 1) return { ok: false, code: "INVALID_VERSION" };
  if (!s.templateKey?.trim()) return { ok: false, code: "MISSING_TEMPLATE_KEY" };
  if (!Array.isArray(s.sections) || s.sections.length === 0) {
    return { ok: false, code: "MISSING_SECTIONS" };
  }
  if (s.sections.length > QUESTIONNAIRE_LIMITS.maxSections) {
    return { ok: false, code: "TOO_MANY_SECTIONS" };
  }

  const sectionIds = new Set<string>();
  const questionIds = new Set<string>();
  let questionCount = 0;

  for (const section of s.sections) {
    if (!section.id?.trim()) return { ok: false, code: "INVALID_SECTION_ID" };
    if (sectionIds.has(section.id)) {
      return { ok: false, code: "DUPLICATE_SECTION_ID" };
    }
    sectionIds.add(section.id);
    if (!Array.isArray(section.questions)) {
      return { ok: false, code: "INVALID_SECTION_QUESTIONS" };
    }

    for (const q of section.questions) {
      questionCount++;
      if (questionCount > QUESTIONNAIRE_LIMITS.maxQuestions) {
        return { ok: false, code: "TOO_MANY_QUESTIONS" };
      }
      if (!q.id?.trim()) return { ok: false, code: "INVALID_QUESTION_ID" };
      if (questionIds.has(q.id)) {
        return { ok: false, code: "DUPLICATE_QUESTION_ID" };
      }
      questionIds.add(q.id);

      if (!ANSWERABLE_TYPES.has(q.type) && !DISPLAY_ONLY_TYPES.has(q.type)) {
        return { ok: false, code: "UNSUPPORTED_FIELD_TYPE" };
      }

      if (
        (q.type === "select" ||
          q.type === "multiselect" ||
          q.type === "radio" ||
          q.type === "checkbox") &&
        (!q.options || q.options.length === 0)
      ) {
        return { ok: false, code: "INVALID_SELECT_OPTIONS" };
      }
      if (
        q.options &&
        q.options.length > QUESTIONNAIRE_LIMITS.maxOptionsPerQuestion
      ) {
        return { ok: false, code: "TOO_MANY_OPTIONS" };
      }

      if (q.visibleWhen) {
        if (!questionIds.has(q.visibleWhen.questionId) &&
            !s.sections.some((sec) =>
              sec.questions.some((prev) => prev.id === q.visibleWhen!.questionId),
            )) {
          const priorExists = s.sections.some((sec, si) => {
            const secIdx = s.sections.findIndex((x) => x.id === section.id);
            if (sec.id === section.id) {
              const qIdx = sec.questions.findIndex((x) => x.id === q.id);
              return sec.questions
                .slice(0, qIdx)
                .some((x) => x.id === q.visibleWhen!.questionId);
            }
            return si < secIdx && sec.questions.some(
              (x) => x.id === q.visibleWhen!.questionId,
            );
          });
          if (!priorExists && !questionIds.has(q.visibleWhen.questionId)) {
            // allow reference to question defined earlier in same pass
          }
        }
      }
    }
  }

  // Second pass: validate visibleWhen references and circular deps
  const allQuestions = flattenQuestions(s);
  for (const [, q] of allQuestions) {
    if (q.visibleWhen) {
      if (!allQuestions.has(q.visibleWhen.questionId)) {
        return { ok: false, code: "INVALID_CONDITIONAL_REFERENCE" };
      }
    }
  }
  if (hasCircularVisibility(allQuestions)) {
    return { ok: false, code: "CIRCULAR_VISIBILITY" };
  }

  return { ok: true, schema: s };
}

function hasCircularVisibility(
  questions: Map<string, QuestionDefinition & { sectionId: string }>,
): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const q = questions.get(id);
    if (q?.visibleWhen) {
      if (dfs(q.visibleWhen.questionId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of questions.keys()) {
    if (dfs(id)) return true;
  }
  return false;
}

export function isAnswerableQuestion(
  question: QuestionDefinition,
): boolean {
  return ANSWERABLE_TYPES.has(question.type);
}

export function getSchemaQuestionIds(schema: QuestionnaireSchema): Set<string> {
  return new Set(flattenQuestions(schema).keys());
}
