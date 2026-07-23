/** Framework-agnostic questionnaire engine types (PR #31). */

export type LocaleLabel = { en: string; ru: string };

export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "boolean"
  | "country"
  | "file"
  | "heading"
  | "information";

/** Persisted answer for `file` questions (binary stored separately). */
export type QuestionnaireFileAnswer = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type VisibilityOperator =
  | "equals"
  | "notEquals"
  | "isEmpty"
  | "isNotEmpty"
  | "includes";

export type VisibilityRule = {
  questionId: string;
  operator: VisibilityOperator;
  value?: string | number | boolean | string[];
};

export type QuestionOption = {
  value: string;
  label: LocaleLabel;
};

export type QuestionValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  minDate?: string;
  maxDate?: string;
  maxSelections?: number;
};

export type QuestionDefinition = {
  id: string;
  type: QuestionType;
  order: number;
  label: LocaleLabel;
  description?: LocaleLabel;
  required?: boolean;
  placeholder?: LocaleLabel;
  options?: QuestionOption[];
  validation?: QuestionValidation;
  visibleWhen?: VisibilityRule;
  readOnly?: boolean;
  derivedFrom?: "portal_email";
};

export type SectionDefinition = {
  id: string;
  order: number;
  title: LocaleLabel;
  description?: LocaleLabel;
  questions: QuestionDefinition[];
};

export type QuestionnaireSchema = {
  schemaVersion: 1;
  templateKey: string;
  title: LocaleLabel;
  description?: LocaleLabel;
  sections: SectionDefinition[];
};

export type QuestionnaireTemplateStatus = "draft" | "published" | "archived";
export type TemplateVersionStatus = "draft" | "published" | "archived";
export type ClientQuestionnaireStatus =
  | "draft"
  | "in_review"
  | "submitted"
  | "locked"
  | "archived";

export type QuestionnaireAnswers = Record<string, unknown>;

export type QuestionnaireRecord = {
  id: string;
  clientPortalUserId: string;
  invitationId: string;
  templateVersionId: string;
  status: ClientQuestionnaireStatus;
  answers: QuestionnaireAnswers;
  revision: number;
  startedAt: string | null;
  lastSavedAt: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type TemplateVersionRecord = {
  id: string;
  templateId: string;
  version: number;
  schema: QuestionnaireSchema;
  schemaHash: string;
  status: TemplateVersionStatus;
  publishedAt: string | null;
  createdAt: string;
};

export type TemplateRecord = {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  status: QuestionnaireTemplateStatus;
};

export type QuestionnairePublicState =
  | "not_started"
  | "draft"
  | "in_review"
  | "submitted"
  | "locked"
  | "archived";

/**
 * Machine-readable validation reasons for client UX.
 * Extend this union when adding new remediation copy — UI maps by reason key.
 */
export type ValidationReasonCode =
  | "OPTION_NO_LONGER_EXISTS"
  | "VALUE_DEPRECATED"
  | "INVALID_COUNTRY"
  | "INVALID_CURRENCY"
  | "MISSING_REQUIRED"
  | "INVALID_DOCUMENT"
  | "SCHEMA_VERSION_MISMATCH"
  | "INVALID_FORMAT"
  | "UNKNOWN";

export type ValidationErrorItem = {
  sectionId: string;
  questionId: string;
  code: string;
  message: string;
  /** Stable reason for localized UX; optional for backward compatibility. */
  reason?: ValidationReasonCode;
  /** Localized field label at validation time. */
  fieldLabel?: string;
};

export type ValidationFieldDetail = {
  field: string;
  section: string;
  reason: ValidationReasonCode;
  label?: string;
};

export type PatchAnswerOperation =
  | { op: "set"; questionId: string; value: unknown }
  | { op: "clear"; questionId: string };

export const QUESTIONNAIRE_LIMITS = {
  maxSections: 30,
  maxQuestions: 300,
  maxAnswerKeys: 300,
  maxStringLength: 10_000,
  maxAnswersJsonBytes: 512 * 1024,
  maxOptionsPerQuestion: 200,
  maxSchemaDepth: 8,
  maxPatchOperations: 100,
} as const;

export const DISPLAY_ONLY_TYPES: ReadonlySet<QuestionType> = new Set([
  "heading",
  "information",
]);

export const ANSWERABLE_TYPES: ReadonlySet<QuestionType> = new Set([
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "date",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "boolean",
  "country",
  "file",
]);
