import type {
  LocaleLabel,
  PatchAnswerOperation,
  QuestionDefinition,
  QuestionnaireAnswers,
  QuestionnaireSchema,
  ValidationErrorItem,
} from "./questionnaire-types";
import {
  DISPLAY_ONLY_TYPES,
  QUESTIONNAIRE_LIMITS,
} from "./questionnaire-types";
import {
  answersJsonByteSize,
  isEmptyAnswer,
  normalizeScalarString,
} from "./questionnaire-empty-values";
import { flattenQuestions } from "./questionnaire-schema";
import { isQuestionVisible } from "./questionnaire-visibility";
import { isQuestionnaireFileAnswer } from "./questionnaire-attachment-formats";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

function labelFor(question: QuestionDefinition, locale: "en" | "ru"): string {
  return question.label[locale] || question.label.en || question.id;
}

export function validateAnswersAgainstSchema(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
  locale: "en" | "ru" = "en",
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const questions = flattenQuestions(schema);

  if (Object.keys(answers).length > QUESTIONNAIRE_LIMITS.maxAnswerKeys) {
    errors.push({
      sectionId: schema.sections[0]?.id ?? "unknown",
      questionId: "_payload",
      code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE",
      message: "Too many answer fields",
    });
    return errors;
  }

  if (answersJsonByteSize(answers) > QUESTIONNAIRE_LIMITS.maxAnswersJsonBytes) {
    errors.push({
      sectionId: schema.sections[0]?.id ?? "unknown",
      questionId: "_payload",
      code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE",
      message: "Answers payload too large",
    });
    return errors;
  }

  for (const [questionId, value] of Object.entries(answers)) {
    const q = questions.get(questionId);
    if (!q) {
      errors.push({
        sectionId: "unknown",
        questionId,
        code: "QUESTIONNAIRE_FIELD_UNKNOWN",
        message: `Unknown field: ${questionId}`,
      });
      continue;
    }
    if (DISPLAY_ONLY_TYPES.has(q.type)) {
      errors.push({
        sectionId: q.sectionId,
        questionId,
        code: "QUESTIONNAIRE_FIELD_UNKNOWN",
        message: `Display-only field cannot be answered: ${questionId}`,
      });
    }
  }

  for (const [questionId, q] of questions) {
    if (DISPLAY_ONLY_TYPES.has(q.type)) continue;
    if (!isQuestionVisible(q, answers)) continue;

    const value = answers[questionId];
    const label = labelFor(q, locale);

    if (q.readOnly && q.derivedFrom) {
      continue;
    }

    if (q.required && isEmptyAnswer(value)) {
      errors.push({
        sectionId: q.sectionId,
        questionId,
        code: "REQUIRED",
        message: `${label} is required`,
      });
      continue;
    }

    if (isEmptyAnswer(value)) continue;

    const typeError = validateValueType(q, value, locale);
    if (typeError) {
      errors.push({
        sectionId: q.sectionId,
        questionId,
        code: typeError.code,
        message: typeError.message,
      });
    }
  }

  return errors;
}

function validateValueType(
  q: QuestionDefinition & { sectionId: string },
  value: unknown,
  locale: "en" | "ru",
): { code: string; message: string } | null {
  const label = labelFor(q, locale);
  const v = q.validation;

  switch (q.type) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "country": {
      if (typeof value !== "string") {
        return { code: "QUESTIONNAIRE_VALUE_INVALID", message: `${label} must be text` };
      }
      const s = normalizeScalarString(value);
      if (!s) return null;
      if (s.length > (v?.maxLength ?? QUESTIONNAIRE_LIMITS.maxStringLength)) {
        return { code: "MAX_LENGTH", message: `${label} is too long` };
      }
      if (v?.minLength && s.length < v.minLength) {
        return { code: "MIN_LENGTH", message: `${label} is too short` };
      }
      if (q.type === "email" && !EMAIL_RE.test(s)) {
        return { code: "INVALID_EMAIL", message: `${label} must be a valid email` };
      }
      if (q.type === "phone" && !PHONE_RE.test(s)) {
        return { code: "INVALID_PHONE", message: `${label} must be a valid phone` };
      }
      if (q.type === "country" && !COUNTRY_RE.test(s)) {
        return { code: "INVALID_COUNTRY", message: `${label} must be ISO country code` };
      }
      return null;
    }
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return { code: "QUESTIONNAIRE_VALUE_INVALID", message: `${label} must be a number` };
      }
      if (v?.integer && !Number.isInteger(value)) {
        return { code: "INVALID_INTEGER", message: `${label} must be an integer` };
      }
      if (v?.min !== undefined && value < v.min) {
        return { code: "MIN_VALUE", message: `${label} is below minimum` };
      }
      if (v?.max !== undefined && value > v.max) {
        return { code: "MAX_VALUE", message: `${label} is above maximum` };
      }
      return null;
    }
    case "date": {
      if (typeof value !== "string" || !DATE_RE.test(value)) {
        return { code: "INVALID_DATE", message: `${label} must be YYYY-MM-DD` };
      }
      if (v?.minDate && value < v.minDate) {
        return { code: "MIN_DATE", message: `${label} is too early` };
      }
      if (v?.maxDate && value > v.maxDate) {
        return { code: "MAX_DATE", message: `${label} is too late` };
      }
      return null;
    }
    case "select":
    case "radio": {
      if (typeof value !== "string") {
        return { code: "QUESTIONNAIRE_VALUE_INVALID", message: `${label} invalid` };
      }
      const allowed = new Set(q.options?.map((o) => o.value));
      if (!allowed.has(value)) {
        return { code: "INVALID_OPTION", message: `${label} has invalid option` };
      }
      return null;
    }
    case "multiselect":
    case "checkbox": {
      if (!Array.isArray(value) || !value.every((x) => typeof x === "string")) {
        return { code: "QUESTIONNAIRE_VALUE_INVALID", message: `${label} must be array` };
      }
      const allowed = new Set(q.options?.map((o) => o.value));
      for (const item of value) {
        if (!allowed.has(item)) {
          return { code: "INVALID_OPTION", message: `${label} has invalid option` };
        }
      }
      if (v?.maxSelections && value.length > v.maxSelections) {
        return { code: "MAX_SELECTIONS", message: `${label} has too many selections` };
      }
      return null;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        return { code: "QUESTIONNAIRE_VALUE_INVALID", message: `${label} must be boolean` };
      }
      return null;
    }
    case "file": {
      if (!isQuestionnaireFileAnswer(value)) {
        return { code: "QUESTIONNAIRE_VALUE_INVALID", message: `${label} must be a file attachment` };
      }
      if (value.fileName.length > 255) {
        return { code: "MAX_LENGTH", message: `${label} file name is too long` };
      }
      return null;
    }
    default:
      return null;
  }
}

export function sanitizePatchAnswers(
  schema: QuestionnaireSchema,
  patch: QuestionnaireAnswers,
  existing: QuestionnaireAnswers,
): { ok: true; merged: QuestionnaireAnswers } | { ok: false; code: string } {
  const questions = flattenQuestions(schema);
  const merged = { ...existing };

  for (const [key, value] of Object.entries(patch)) {
    const q = questions.get(key);
    if (!q) return { ok: false, code: "QUESTIONNAIRE_FIELD_UNKNOWN" };
    if (DISPLAY_ONLY_TYPES.has(q.type)) {
      return { ok: false, code: "QUESTIONNAIRE_FIELD_UNKNOWN" };
    }
    if (q.readOnly || q.derivedFrom) {
      return { ok: false, code: "QUESTIONNAIRE_READ_ONLY" };
    }

    if (value === null || value === undefined) {
      delete merged[key];
      continue;
    }

    merged[key] = value;
  }

  if (answersJsonByteSize(merged) > QUESTIONNAIRE_LIMITS.maxAnswersJsonBytes) {
    return { ok: false, code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE" };
  }

  return { ok: true, merged };
}

export function applyAnswerOperations(
  schema: QuestionnaireSchema,
  operations: PatchAnswerOperation[],
  existing: QuestionnaireAnswers,
): { ok: true; merged: QuestionnaireAnswers } | { ok: false; code: string } {
  if (operations.length > QUESTIONNAIRE_LIMITS.maxPatchOperations) {
    return { ok: false, code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE" };
  }

  const seen = new Set<string>();
  const questions = flattenQuestions(schema);
  const merged = { ...existing };

  for (const op of operations) {
    if (seen.has(op.questionId)) {
      return { ok: false, code: "QUESTIONNAIRE_VALUE_INVALID" };
    }
    seen.add(op.questionId);

    const q = questions.get(op.questionId);
    if (!q || DISPLAY_ONLY_TYPES.has(q.type)) {
      return { ok: false, code: "QUESTIONNAIRE_FIELD_UNKNOWN" };
    }
    if (q.readOnly || q.derivedFrom) {
      return { ok: false, code: "QUESTIONNAIRE_READ_ONLY" };
    }

    if (op.op === "clear") {
      delete merged[op.questionId];
      continue;
    }

    if (op.op === "set") {
      merged[op.questionId] = op.value;
      continue;
    }

    return { ok: false, code: "QUESTIONNAIRE_VALUE_INVALID" };
  }

  if (answersJsonByteSize(merged) > QUESTIONNAIRE_LIMITS.maxAnswersJsonBytes) {
    return { ok: false, code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE" };
  }

  return { ok: true, merged };
}

export function hasMeaningfulAnswers(answers: QuestionnaireAnswers): boolean {
  return Object.entries(answers).some(([, v]) => !isEmptyAnswer(v));
}
