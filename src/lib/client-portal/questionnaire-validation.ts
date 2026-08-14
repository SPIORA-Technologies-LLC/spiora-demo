import { isQuestionnaireFileAnswer } from "./questionnaire-attachment-formats";
import { mapValidationCodeToReason } from "./questionnaire-validation-payload";
import {
  normalizeCountryAnswers,
  resolveCountryToIso,
} from "./questionnaire-countries";
import { flattenQuestions } from "./questionnaire-flatten";
import { isQuestionVisible } from "./questionnaire-visibility";
import {
  answersJsonByteSize,
  isEmptyAnswer,
  normalizeScalarString,
} from "./questionnaire-empty-values";
import {
  DISPLAY_ONLY_TYPES,
  QUESTIONNAIRE_LIMITS,
} from "./questionnaire-types";
import type {
  QuestionDefinition,
  QuestionnaireAnswers,
  QuestionnaireSchema,
  ValidationErrorItem,
  ValidationReasonCode,
  PatchAnswerOperation,
} from "./questionnaire-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function labelFor(question: QuestionDefinition, locale: "en" | "ru"): string {
  return question.label[locale] || question.label.en || question.id;
}

function pushError(
  errors: ValidationErrorItem[],
  input: {
    sectionId: string;
    questionId: string;
    code: string;
    message: string;
    fieldLabel?: string;
    reason?: ValidationReasonCode;
  },
) {
  errors.push({
    sectionId: input.sectionId,
    questionId: input.questionId,
    code: input.code,
    message: input.message,
    fieldLabel: input.fieldLabel,
    reason:
      input.reason ??
      mapValidationCodeToReason(input.code, input.questionId),
  });
}

export function validateAnswersAgainstSchema(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
  locale: "en" | "ru" = "en",
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const questions = flattenQuestions(schema);
  // Accept country names by normalizing to ISO before checks.
  answers = normalizeCountryAnswers(schema, answers);

  if (Object.keys(answers).length > QUESTIONNAIRE_LIMITS.maxAnswerKeys) {
    pushError(errors, {
      sectionId: schema.sections[0]?.id ?? "unknown",
      questionId: "_payload",
      code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE",
      message: "Too many answer fields",
      reason: "INVALID_FORMAT",
    });
    return errors;
  }

  if (answersJsonByteSize(answers) > QUESTIONNAIRE_LIMITS.maxAnswersJsonBytes) {
    pushError(errors, {
      sectionId: schema.sections[0]?.id ?? "unknown",
      questionId: "_payload",
      code: "QUESTIONNAIRE_PAYLOAD_TOO_LARGE",
      message: "Answers payload too large",
      reason: "INVALID_FORMAT",
    });
    return errors;
  }

  for (const [questionId, value] of Object.entries(answers)) {
    const q = questions.get(questionId);
    if (!q) {
      pushError(errors, {
        sectionId: "unknown",
        questionId,
        code: "QUESTIONNAIRE_FIELD_UNKNOWN",
        message: `Unknown field: ${questionId}`,
        reason: "UNKNOWN",
      });
      continue;
    }
    if (DISPLAY_ONLY_TYPES.has(q.type)) {
      pushError(errors, {
        sectionId: q.sectionId,
        questionId,
        code: "QUESTIONNAIRE_FIELD_UNKNOWN",
        message: `Display-only field cannot be answered: ${questionId}`,
        reason: "UNKNOWN",
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
      pushError(errors, {
        sectionId: q.sectionId,
        questionId,
        code: "REQUIRED",
        message: `${label} is required`,
        fieldLabel: label,
        reason: "MISSING_REQUIRED",
      });
      continue;
    }

    if (isEmptyAnswer(value)) continue;

    const typeError = validateValueType(q, value, locale);
    if (typeError) {
      pushError(errors, {
        sectionId: q.sectionId,
        questionId,
        code: typeError.code,
        message: typeError.message,
        fieldLabel: label,
        reason: typeError.reason,
      });
    }
  }

  return errors;
}

function validateValueType(
  q: QuestionDefinition & { sectionId: string },
  value: unknown,
  locale: "en" | "ru",
): { code: string; message: string; reason: ValidationReasonCode } | null {
  const label = labelFor(q, locale);
  const v = q.validation;

  switch (q.type) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "country": {
      if (typeof value !== "string") {
        return {
          code: "QUESTIONNAIRE_VALUE_INVALID",
          message: `${label} must be text`,
          reason: "INVALID_FORMAT",
        };
      }
      const s = normalizeScalarString(value);
      if (!s) return null;
      if (s.length > (v?.maxLength ?? QUESTIONNAIRE_LIMITS.maxStringLength)) {
        return {
          code: "MAX_LENGTH",
          message: `${label} is too long`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.minLength && s.length < v.minLength) {
        return {
          code: "MIN_LENGTH",
          message: `${label} is too short`,
          reason: "INVALID_FORMAT",
        };
      }
      if (q.type === "email" && !EMAIL_RE.test(s)) {
        return {
          code: "INVALID_EMAIL",
          message: `${label} must be a valid email`,
          reason: "INVALID_FORMAT",
        };
      }
      if (q.type === "phone" && !PHONE_RE.test(s)) {
        return {
          code: "INVALID_PHONE",
          message: `${label} must be a valid phone`,
          reason: "INVALID_FORMAT",
        };
      }
      if (q.type === "country") {
        const iso = resolveCountryToIso(s);
        if (!iso) {
          return {
            code: "INVALID_COUNTRY",
            message: `${label} must be a valid country`,
            reason: "INVALID_COUNTRY",
          };
        }
      }
      return null;
    }
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return {
          code: "QUESTIONNAIRE_VALUE_INVALID",
          message: `${label} must be a number`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.integer && !Number.isInteger(value)) {
        return {
          code: "INVALID_INTEGER",
          message: `${label} must be an integer`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.min !== undefined && value < v.min) {
        return {
          code: "MIN_VALUE",
          message: `${label} is below minimum`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.max !== undefined && value > v.max) {
        return {
          code: "MAX_VALUE",
          message: `${label} is above maximum`,
          reason: "INVALID_FORMAT",
        };
      }
      return null;
    }
    case "date": {
      if (typeof value !== "string" || !DATE_RE.test(value)) {
        return {
          code: "INVALID_DATE",
          message: `${label} must be YYYY-MM-DD`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.minDate && value < v.minDate) {
        return {
          code: "MIN_DATE",
          message: `${label} is too early`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.maxDate && value > v.maxDate) {
        return {
          code: "MAX_DATE",
          message: `${label} is too late`,
          reason: "INVALID_FORMAT",
        };
      }
      return null;
    }
    case "select":
    case "radio": {
      if (typeof value !== "string") {
        return {
          code: "QUESTIONNAIRE_VALUE_INVALID",
          message: `${label} invalid`,
          reason: "INVALID_FORMAT",
        };
      }
      const allowed = new Set(q.options?.map((o) => o.value));
      if (!allowed.has(value)) {
        return {
          code: "INVALID_OPTION",
          message: `${label} has invalid option`,
          reason: mapValidationCodeToReason("INVALID_OPTION", q.id),
        };
      }
      return null;
    }
    case "multiselect":
    case "checkbox": {
      if (!Array.isArray(value) || !value.every((x) => typeof x === "string")) {
        return {
          code: "QUESTIONNAIRE_VALUE_INVALID",
          message: `${label} must be array`,
          reason: "INVALID_FORMAT",
        };
      }
      const allowed = new Set(q.options?.map((o) => o.value));
      for (const item of value) {
        if (!allowed.has(item)) {
          return {
            code: "INVALID_OPTION",
            message: `${label} has invalid option`,
            reason: mapValidationCodeToReason("INVALID_OPTION", q.id),
          };
        }
      }
      if (v?.maxSelections && value.length > v.maxSelections) {
        return {
          code: "MAX_SELECTIONS",
          message: `${label} has too many selections`,
          reason: "INVALID_FORMAT",
        };
      }
      return null;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        return {
          code: "QUESTIONNAIRE_VALUE_INVALID",
          message: `${label} must be boolean`,
          reason: "INVALID_FORMAT",
        };
      }
      if (v?.mustBeTrue && value !== true) {
        return {
          code: "CONSENT_REQUIRED",
          message: `${label} must be accepted`,
          reason: "MISSING_REQUIRED",
        };
      }
      return null;
    }
    case "file": {
      if (!isQuestionnaireFileAnswer(value)) {
        return {
          code: "QUESTIONNAIRE_VALUE_INVALID",
          message: `${label} must be a file attachment`,
          reason: "INVALID_DOCUMENT",
        };
      }
      if (value.fileName.length > 255) {
        return {
          code: "MAX_LENGTH",
          message: `${label} file name is too long`,
          reason: "INVALID_DOCUMENT",
        };
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
      const qType = questions.get(op.questionId)?.type;
      if (qType === "country") {
        const iso = resolveCountryToIso(op.value);
        if (iso) {
          merged[op.questionId] = iso;
        } else {
          merged[op.questionId] = op.value;
        }
      } else {
        merged[op.questionId] = op.value;
      }
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
