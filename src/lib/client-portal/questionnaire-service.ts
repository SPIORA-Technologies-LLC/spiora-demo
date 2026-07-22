import type {
  ClientQuestionnaireStatus,
  PatchAnswerOperation,
  QuestionnaireAnswers,
  QuestionnairePublicState,
  QuestionnaireRecord,
  TemplateVersionRecord,
  ValidationErrorItem,
} from "./questionnaire-types";
import {
  applyAnswerOperations,
  hasMeaningfulAnswers,
  validateAnswersAgainstSchema,
} from "./questionnaire-validation";
import { calculateQuestionnaireProgress } from "./questionnaire-progress";
import {
  GENERAL_CLIENT_ONBOARDING_SCHEMA,
  GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY,
} from "./questionnaire-demo-template";
import {
  GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH,
  hashQuestionnaireSchema,
} from "./questionnaire-schema";

export type QuestionnaireStore = {
  getPublishedVersionByTemplateKey(
    templateKey: string,
  ): Promise<TemplateVersionRecord | null>;
  getPublishedVersionById(
    id: string,
  ): Promise<TemplateVersionRecord | null>;
  getByInvitationId(invitationId: string): Promise<QuestionnaireRecord | null>;
  getById(id: string): Promise<QuestionnaireRecord | null>;
  createDraft(input: {
    clientPortalUserId: string;
    invitationId: string;
    templateVersionId: string;
    answers: QuestionnaireAnswers;
    startedAt: string;
  }): Promise<QuestionnaireRecord>;
  updateDraft(input: {
    id: string;
    baseRevision: number;
    answers: QuestionnaireAnswers;
    lastSavedAt: string;
  }): Promise<
    | { ok: true; record: QuestionnaireRecord }
    | { ok: false; code: "QUESTIONNAIRE_REVISION_CONFLICT" }
  >;
  setStatus(input: {
    id: string;
    baseRevision: number;
    status: ClientQuestionnaireStatus;
    reviewedAt?: string | null;
  }): Promise<
    | { ok: true; record: QuestionnaireRecord }
    | { ok: false; code: "QUESTIONNAIRE_REVISION_CONFLICT" }
  >;
};

export type ClientQuestionnaireContext = {
  portalUserId: string;
  invitationId: string;
  portalEmail: string;
  templateKey: string | null;
};

export type CurrentQuestionnaireDto = {
  questionnaire: {
    id: string | null;
    status: QuestionnairePublicState;
    revision: number | null;
    answers: QuestionnaireAnswers;
    startedAt: string | null;
    lastSavedAt: string | null;
    reviewedAt: string | null;
  };
  template: {
    id: string;
    version: number;
    schema: TemplateVersionRecord["schema"];
    schemaHash: string;
  };
  progress: ReturnType<typeof calculateQuestionnaireProgress>;
};

function mapStatus(record: QuestionnaireRecord | null): QuestionnairePublicState {
  if (!record) return "not_started";
  if (record.status === "draft") return "draft";
  if (record.status === "in_review") return "in_review";
  if (record.status === "submitted") return "submitted";
  if (record.status === "locked") return "locked";
  if (record.status === "archived") return "archived";
  return "draft";
}

/**
 * When a published row's schema_hash matches the known demo constant, prefer the
 * in-code canonical schema. SQL seed / jsonb drift can leave schema JSON out of
 * sync with a repaired schema_hash (hash(schema) !== schema_hash).
 */
export function reconcilePublishedTemplateVersion(
  version: TemplateVersionRecord,
): TemplateVersionRecord {
  const templateKey = version.schema?.templateKey;
  if (
    templateKey === GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY &&
    version.schemaHash === GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH
  ) {
    return { ...version, schema: GENERAL_CLIENT_ONBOARDING_SCHEMA };
  }
  return version;
}

export function resolvePublishedTemplateVersion(
  version: TemplateVersionRecord,
): TemplateVersionRecord | null {
  const reconciled = reconcilePublishedTemplateVersion(version);
  try {
    if (hashQuestionnaireSchema(reconciled.schema) !== reconciled.schemaHash) {
      return null;
    }
  } catch {
    return null;
  }
  return reconciled;
}

export async function getCurrentQuestionnaire(
  ctx: ClientQuestionnaireContext,
  store: QuestionnaireStore,
): Promise<
  | { ok: true; data: CurrentQuestionnaireDto }
  | { ok: false; code: string }
> {
  const record = await store.getByInvitationId(ctx.invitationId);
  const version = record
    ? await store.getPublishedVersionById(record.templateVersionId)
    : ctx.templateKey
      ? await store.getPublishedVersionByTemplateKey(ctx.templateKey)
      : null;
  if (!version || version.status !== "published") {
    return { ok: false, code: "QUESTIONNAIRE_NOT_AVAILABLE" };
  }
  const resolved = resolvePublishedTemplateVersion(version);
  if (!resolved) {
    return { ok: false, code: "QUESTIONNAIRE_SCHEMA_INVALID" };
  }
  const answers = record?.answers ?? {};
  const progress = calculateQuestionnaireProgress(resolved.schema, answers);

  return {
    ok: true,
    data: {
      questionnaire: {
        id: record?.id ?? null,
        status: mapStatus(record),
        revision: record?.revision ?? null,
        answers,
        startedAt: record?.startedAt ?? null,
        lastSavedAt: record?.lastSavedAt ?? null,
        reviewedAt: record?.reviewedAt ?? null,
      },
      template: {
        id: resolved.id,
        version: resolved.version,
        schema: resolved.schema,
        schemaHash: resolved.schemaHash,
      },
      progress,
    },
  };
}

export async function saveQuestionnaireDraft(
  ctx: ClientQuestionnaireContext,
  store: QuestionnaireStore,
  input: {
    baseRevision: number | null;
    operations: PatchAnswerOperation[];
    locale: "en" | "ru";
  },
): Promise<
  | {
      ok: true;
      questionnaireId: string;
      revision: number;
      answers: QuestionnaireAnswers;
      lastSavedAt: string;
      created: boolean;
    }
  | { ok: false; code: string; errors?: ValidationErrorItem[] }
> {
  let record = await store.getByInvitationId(ctx.invitationId);
  const version = record
    ? await store.getPublishedVersionById(record.templateVersionId)
    : ctx.templateKey
      ? await store.getPublishedVersionByTemplateKey(ctx.templateKey)
      : null;
  if (!version || version.status !== "published") {
    return { ok: false, code: "QUESTIONNAIRE_NOT_AVAILABLE" };
  }
  const resolved = resolvePublishedTemplateVersion(version);
  if (!resolved) {
    return { ok: false, code: "QUESTIONNAIRE_SCHEMA_INVALID" };
  }

  if (record && (record.status === "in_review" || record.status === "submitted" || record.status === "locked")) {
    return { ok: false, code: "QUESTIONNAIRE_READ_ONLY" };
  }

  const existing = record?.answers ?? {};
  const sanitized = applyAnswerOperations(resolved.schema, input.operations, existing);
  if (!sanitized.ok) return { ok: false, code: sanitized.code };

  const merged = sanitized.merged;
  const typeErrors = validateAnswersAgainstSchema(resolved.schema, merged, input.locale);
  if (typeErrors.some((e) => e.code === "QUESTIONNAIRE_FIELD_UNKNOWN" || e.code === "QUESTIONNAIRE_VALUE_INVALID")) {
    return { ok: false, code: "QUESTIONNAIRE_VALUE_INVALID", errors: typeErrors };
  }

  if (!hasMeaningfulAnswers(merged)) {
    return { ok: false, code: "QUESTIONNAIRE_NOT_AVAILABLE" };
  }

  const now = new Date().toISOString();

  if (!record) {
    const created = await store.createDraft({
      clientPortalUserId: ctx.portalUserId,
      invitationId: ctx.invitationId,
      templateVersionId: resolved.id,
      answers: merged,
      startedAt: now,
    });
    return {
      ok: true,
      questionnaireId: created.id,
      revision: created.revision,
      answers: created.answers,
      lastSavedAt: created.lastSavedAt ?? now,
      created: true,
    };
  }

  if (input.baseRevision === null || input.baseRevision !== record.revision) {
    return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
  }

  const updated = await store.updateDraft({
    id: record.id,
    baseRevision: record.revision,
    answers: merged,
    lastSavedAt: now,
  });
  if (!updated.ok) {
    return { ok: false, code: updated.code };
  }

  return {
    ok: true,
    questionnaireId: updated.record.id,
    revision: updated.record.revision,
    answers: updated.record.answers,
    lastSavedAt: updated.record.lastSavedAt ?? now,
    created: false,
  };
}

export async function validateQuestionnaireDraft(
  ctx: ClientQuestionnaireContext,
  store: QuestionnaireStore,
  locale: "en" | "ru",
): Promise<{ valid: boolean; errors: ValidationErrorItem[] }> {
  const record = await store.getByInvitationId(ctx.invitationId);
  const version = record
    ? await store.getPublishedVersionById(record.templateVersionId)
    : ctx.templateKey
      ? await store.getPublishedVersionByTemplateKey(ctx.templateKey)
      : null;
  if (!version) {
    return {
      valid: false,
      errors: [{
        sectionId: "unknown",
        questionId: "_schema",
        code: "QUESTIONNAIRE_NOT_AVAILABLE",
        message: "Questionnaire not available",
      }],
    };
  }
  const resolved = resolvePublishedTemplateVersion(version);
  if (!resolved) {
    return {
      valid: false,
      errors: [{
        sectionId: "unknown",
        questionId: "_schema",
        code: "QUESTIONNAIRE_SCHEMA_INVALID",
        message: "Questionnaire schema is invalid",
      }],
    };
  }
  const answers = record?.answers ?? {};
  const errors = validateAnswersAgainstSchema(resolved.schema, answers, locale);
  return { valid: errors.length === 0, errors };
}

export async function moveQuestionnaireToReview(
  ctx: ClientQuestionnaireContext,
  store: QuestionnaireStore,
  locale: "en" | "ru",
): Promise<
  | { ok: true; record: QuestionnaireRecord }
  | { ok: false; code: string; errors?: ValidationErrorItem[] }
> {
  const record = await store.getByInvitationId(ctx.invitationId);
  if (!record) return { ok: false, code: "QUESTIONNAIRE_NOT_AVAILABLE" };
  if (record.status === "in_review") {
    return { ok: true, record };
  }
  if (record.status !== "draft") {
    return { ok: false, code: "QUESTIONNAIRE_READ_ONLY" };
  }

  const version = await store.getPublishedVersionById(record.templateVersionId);
  if (!version) return { ok: false, code: "QUESTIONNAIRE_NOT_AVAILABLE" };
  const resolved = resolvePublishedTemplateVersion(version);
  if (!resolved) return { ok: false, code: "QUESTIONNAIRE_SCHEMA_INVALID" };

  const errors = validateAnswersAgainstSchema(resolved.schema, record.answers, locale);
  if (errors.length > 0) {
    return { ok: false, code: "QUESTIONNAIRE_VALIDATION_FAILED", errors };
  }

  const now = new Date().toISOString();
  const updated = await store.setStatus({
    id: record.id,
    baseRevision: record.revision,
    status: "in_review",
    reviewedAt: now,
  });
  if (!updated.ok) return { ok: false, code: updated.code };
  return { ok: true, record: updated.record };
}

export async function reopenQuestionnaireDraft(
  ctx: ClientQuestionnaireContext,
  store: QuestionnaireStore,
): Promise<
  | { ok: true; record: QuestionnaireRecord }
  | { ok: false; code: string }
> {
  const record = await store.getByInvitationId(ctx.invitationId);
  if (!record) return { ok: false, code: "QUESTIONNAIRE_NOT_AVAILABLE" };
  if (record.status === "draft") return { ok: true, record };
  if (record.status !== "in_review") {
    return { ok: false, code: "QUESTIONNAIRE_NOT_IN_REVIEW" };
  }

  const updated = await store.setStatus({
    id: record.id,
    baseRevision: record.revision,
    status: "draft",
    reviewedAt: null,
  });
  if (!updated.ok) return { ok: false, code: updated.code };
  return { ok: true, record: updated.record };
}

export function assertQuestionnaireOwnership(
  record: QuestionnaireRecord,
  ctx: ClientQuestionnaireContext,
): boolean {
  return (
    record.clientPortalUserId === ctx.portalUserId &&
    record.invitationId === ctx.invitationId
  );
}
