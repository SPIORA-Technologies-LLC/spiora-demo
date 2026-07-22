import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { validateSchemaStructure, hashQuestionnaireSchema } from "./questionnaire-schema.ts";
import { calculateQuestionnaireProgress } from "./questionnaire-progress.ts";
import { buildReviewSections, formatAnswerForReview } from "./questionnaire-review.ts";
import { applyAnswerOperations, validateAnswersAgainstSchema, hasMeaningfulAnswers } from "./questionnaire-validation.ts";
import { saveQuestionnaireDraft, moveQuestionnaireToReview, reopenQuestionnaireDraft } from "./questionnaire-service.ts";

describe("questionnaire schema", () => {
  it("accepts valid demo schema", () => {
    const result = validateSchemaStructure(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    assert.equal(result.ok, true);
  });

  it("published schema hash stays stable", () => {
    const a = hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    const b = hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    assert.equal(a, b);
    assert.equal(a.length, 64);
    assert.equal(
      a,
      "222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac",
    );
  });
});

describe("questionnaire validation and progress", () => {
  it("reports required fields and counts progress", () => {
    const errors = validateAnswersAgainstSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      {},
      "en",
    );
    assert.ok(errors.some((e) => e.questionId === "first_name"));
    const progress = calculateQuestionnaireProgress(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      {},
    );
    assert.equal(progress.percent >= 0, true);
  });

  it("rejects unknown and read-only fields in operations", () => {
    const bad = applyAnswerOperations(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      [{ op: "set", questionId: "unknown_field", value: "x" }],
      {},
    );
    assert.equal(bad.ok, false);

    const ro = applyAnswerOperations(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      [{ op: "set", questionId: "email", value: "x@example.com" }],
      {},
    );
    assert.equal(ro.ok, false);
  });

  it("treats boolean false as a value and clear as delete", () => {
    const first = applyAnswerOperations(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      [{ op: "set", questionId: "previous_refusal", value: false }],
      {},
    );
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.merged.previous_refusal, false);
    }

    const second = applyAnswerOperations(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      [{ op: "clear", questionId: "previous_refusal" }],
      first.ok ? first.merged : {},
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal("previous_refusal" in second.merged, false);
    }
  });

  it("rejects duplicate operations for one question", () => {
    const result = applyAnswerOperations(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      [
        { op: "set", questionId: "first_name", value: "Ivan" },
        { op: "clear", questionId: "first_name" },
      ],
      {},
    );
    assert.equal(result.ok, false);
  });
});

describe("questionnaire review formatting", () => {
  it("formats localized option labels and hides display-only fields", () => {
    const sections = buildReviewSections(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      {
        service_goal: "consultation",
        previous_refusal: false,
      },
      "ru",
    );
    const serviceSection = sections.find((section) => section.id === "service_information");
    assert.ok(serviceSection);
    assert.ok(serviceSection?.items.some((item) => item.questionId === "service_goal" && item.value === "Консультация"));
    assert.equal(sections.some((section) => section.items.some((item) => item.questionId === "welcome_heading")), false);
  });

  it("formats country and boolean answers", () => {
    const allQuestions = GENERAL_CLIENT_ONBOARDING_SCHEMA.sections.flatMap((section) => section.questions);
    const countryQuestion = allQuestions.find((q) => q.id === "country_of_residence");
    const booleanQuestion = allQuestions.find((q) => q.id === "previous_refusal");
    assert.equal(formatAnswerForReview(countryQuestion!, "HR", "en").length > 0, true);
    assert.equal(formatAnswerForReview(booleanQuestion!, false, "ru"), "Нет");
  });
});

describe("questionnaire draft lifecycle", () => {
  const ctx = {
    portalUserId: "portal-1",
    invitationId: "invite-1",
    portalEmail: "client@example.com",
    templateKey: "general_client_onboarding",
  };

  function makeStore() {
    const version = {
      id: "v1",
      templateId: "t1",
      version: 1,
      schema: GENERAL_CLIENT_ONBOARDING_SCHEMA,
      schemaHash: hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA),
      status: "published" as const,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    let record: any = null;
    return {
      async getPublishedVersionByTemplateKey(templateKey: string) {
        return templateKey === "general_client_onboarding" ? version : null;
      },
      async getPublishedVersionById() {
        return version;
      },
      async getByInvitationId() {
        return record;
      },
      async getById() {
        return record;
      },
      async createDraft(input: any) {
        record = {
          id: "q1",
          clientPortalUserId: input.clientPortalUserId,
          invitationId: input.invitationId,
          templateVersionId: input.templateVersionId,
          status: "draft",
          answers: input.answers,
          revision: 1,
          startedAt: input.startedAt,
          lastSavedAt: input.startedAt,
          reviewedAt: null,
          submittedAt: null,
          createdAt: input.startedAt,
          updatedAt: input.startedAt,
          archivedAt: null,
        };
        return record;
      },
      async updateDraft(input: any) {
        if (!record || record.revision !== input.baseRevision) {
          return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" as const };
        }
        record = { ...record, answers: input.answers, revision: input.baseRevision + 1, lastSavedAt: input.lastSavedAt };
        return { ok: true as const, record };
      },
      async setStatus(input: any) {
        if (!record || record.revision !== input.baseRevision) {
          return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" as const };
        }
        record = { ...record, status: input.status, reviewedAt: input.reviewedAt ?? null, revision: input.baseRevision + 1 };
        return { ok: true as const, record };
      },
    };
  }

  it("first meaningful change creates one draft", async () => {
    const store = makeStore();
    const result = await saveQuestionnaireDraft(ctx, store as any, {
      baseRevision: null,
      operations: [{ op: "set", questionId: "first_name", value: "Ivan" }],
      locale: "en",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.created, true);
    assert.equal(hasMeaningfulAnswers({ first_name: "Ivan" }), true);
  });

  it("moves to review and reopens", async () => {
    const store = makeStore();
    await saveQuestionnaireDraft(ctx, store as any, {
      baseRevision: null,
      operations: [
        { op: "set", questionId: "first_name", value: "Ivan" },
        { op: "set", questionId: "last_name", value: "Ivanov" },
        { op: "set", questionId: "date_of_birth", value: "1990-01-01" },
        { op: "set", questionId: "citizenship", value: "UA" },
        { op: "set", questionId: "phone", value: "+3801234567" },
        { op: "set", questionId: "country_of_residence", value: "HR" },
        { op: "set", questionId: "employment_status", value: "employed" },
        { op: "set", questionId: "service_goal", value: "consultation" },
        { op: "set", questionId: "target_country", value: "HR" },
        { op: "set", questionId: "data_accuracy_confirmation", value: true },
        { op: "set", questionId: "privacy_acknowledgement", value: true },
      ],
      locale: "en",
    });
    const review = await moveQuestionnaireToReview(ctx, store as any, "en");
    assert.equal(review.ok, true);
    const reopen = await reopenQuestionnaireDraft(ctx, store as any);
    assert.equal(reopen.ok, true);
  });

  it("falls back to default template key when present in context and rejects unknown key", async () => {
    const store = makeStore();
    const ok = await saveQuestionnaireDraft(
      { ...ctx, templateKey: "general_client_onboarding" },
      store as any,
      {
        baseRevision: null,
        operations: [{ op: "set", questionId: "first_name", value: "Ivan" }],
        locale: "en",
      },
    );
    assert.equal(ok.ok, true);

    const bad = await saveQuestionnaireDraft(
      { ...ctx, invitationId: "invite-2", templateKey: "unknown_template" },
      makeStore() as any,
      {
        baseRevision: null,
        operations: [{ op: "set", questionId: "first_name", value: "Ivan" }],
        locale: "en",
      },
    );
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "QUESTIONNAIRE_NOT_AVAILABLE");
  });

  it("keeps bound template version after invitation-side template change", async () => {
    const store = makeStore();
    const first = await saveQuestionnaireDraft(ctx, store as any, {
      baseRevision: null,
      operations: [{ op: "set", questionId: "first_name", value: "Ivan" }],
      locale: "en",
    });
    assert.equal(first.ok, true);

    const second = await saveQuestionnaireDraft(
      { ...ctx, templateKey: "another_template" },
      store as any,
      {
        baseRevision: 1,
        operations: [{ op: "set", questionId: "last_name", value: "Ivanov" }],
        locale: "en",
      },
    );
    assert.equal(second.ok, true);
  });
});
