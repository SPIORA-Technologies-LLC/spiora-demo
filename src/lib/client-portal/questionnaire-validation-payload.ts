import type {
  ValidationErrorItem,
  ValidationFieldDetail,
  ValidationReasonCode,
} from "./questionnaire-types";

export function mapValidationCodeToReason(
  code: string,
  questionId?: string,
): ValidationReasonCode {
  switch (code) {
    case "REQUIRED":
      return "MISSING_REQUIRED";
    case "INVALID_OPTION":
      if (questionId === "income_currency") return "INVALID_CURRENCY";
      return "OPTION_NO_LONGER_EXISTS";
    case "INVALID_COUNTRY":
      return "INVALID_COUNTRY";
    case "INVALID_EMAIL":
    case "INVALID_PHONE":
    case "INVALID_DATE":
    case "INVALID_INTEGER":
    case "MIN_LENGTH":
    case "MAX_LENGTH":
    case "MIN_VALUE":
    case "MAX_VALUE":
    case "MIN_DATE":
    case "MAX_DATE":
    case "MAX_SELECTIONS":
    case "QUESTIONNAIRE_VALUE_INVALID":
      return "INVALID_FORMAT";
    case "QUESTIONNAIRE_SCHEMA_INVALID":
      return "SCHEMA_VERSION_MISMATCH";
    default:
      if (code.includes("FILE") || code.includes("DOCUMENT")) {
        return "INVALID_DOCUMENT";
      }
      return "UNKNOWN";
  }
}

export function buildValidationFailurePayload(errors: ValidationErrorItem[]) {
  const details: ValidationFieldDetail[] = errors
    .filter((error) => !error.questionId.startsWith("_"))
    .map((error) => ({
      field: error.questionId,
      section: error.sectionId,
      reason:
        error.reason ??
        mapValidationCodeToReason(error.code, error.questionId),
      label: error.fieldLabel,
    }));

  const invalidFields = [...new Set(details.map((item) => item.field))];

  return {
    code: "QUESTIONNAIRE_VALIDATION_FAILED" as const,
    message: "Questionnaire contains invalid answers.",
    invalidFields,
    invalidFieldDetails: details,
    errors,
  };
}

/** Safe structured log — never includes answer values. */
export function logQuestionnaireValidationFailure(errors: ValidationErrorItem[]) {
  const payload = buildValidationFailurePayload(errors);
  console.info(
    JSON.stringify({
      event: "QUESTIONNAIRE_VALIDATION_FAILED",
      invalid_field_count: payload.invalidFields.length,
      invalid_field_keys: payload.invalidFields,
    }),
  );
}
