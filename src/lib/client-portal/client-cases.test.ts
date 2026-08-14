import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { hashQuestionnaireSchema } from "./questionnaire-schema.ts";
import {
  saveQuestionnaireDraft,
  submitQuestionnaire,
  reopenQuestionnaireDraft,
  prepareQuestionnaireSubmission,
} from "./questionnaire-service.ts";
import {
  addCaseComment,
  changeCaseStatus,
  getPortalCaseForUser,
  listIntakeCases,
  addEmployeeCaseDocument,
  getEmployeeCaseDetail,
  toClientCasePublic,
} from "./case-service.ts";
import { createLocalCaseStore } from "./case-local-store.ts";
import {
  CaseStoreConfigurationError,
  isProductionLikeRuntime,
} from "./case-store.ts";
import {
  resolveCaseStoreBackend,
  resetCaseStoreForTests,
} from "./case-store-selection.ts";
import { isAllowedCaseEmployeeDocument } from "./case-employee-document-formats.ts";
import { caseStatusLabel } from "./case-status-labels.ts";

const CASES_FILE = path.join(process.cwd(), ".data", "client-cases.json");

const REQUIRED_OPS = [
  { op: "set" as const, questionId: "first_name", value: "Ivan" },
  { op: "set" as const, questionId: "last_name", value: "Ivanov" },
  { op: "set" as const, questionId: "date_of_birth", value: "1990-01-01" },
  { op: "set" as const, questionId: "citizenship", value: "UA" },
  { op: "set" as const, questionId: "phone", value: "+3801234567" },
  { op: "set" as const, questionId: "country_of_residence", value: "HR" },
  { op: "set" as const, questionId: "address", value: "Zagreb, Ilica 1" },
  { op: "set" as const, questionId: "passport_number", value: "AB123456" },
  { op: "set" as const, questionId: "passport_issue_date", value: "2020-01-15" },
  { op: "set" as const, questionId: "employment_status", value: "employed" },
  { op: "set" as const, questionId: "service_goal", value: "consultation" },
  { op: "set" as const, questionId: "target_country", value: "HR" },
  { op: "set" as const, questionId: "data_accuracy_confirmation", value: true },
  { op: "set" as const, questionId: "privacy_acknowledgement", value: true },
  { op: "set" as const, questionId: "consulting_agreement_acknowledgement", value: true },
];

describe("case store production selection", () => {
  const envBackup = { ...process.env };

  after(() => {
    process.env = { ...envBackup };
    resetCaseStoreForTests();
  });

  it("production never falls back to local JSON", () => {
    process.env = {
      ...envBackup,
      NODE_ENV: "production",
      VERCEL: "1",
      SPIORA_DEMO_MODE: "false",
    };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.throws(
      () => resolveCaseStoreBackend(process.env),
      (err: unknown) => err instanceof CaseStoreConfigurationError,
    );
    assert.equal(isProductionLikeRuntime({ NODE_ENV: "production" }), true);
  });

  it("local development may use local store when supabase unset", () => {
    process.env = {
      ...envBackup,
      NODE_ENV: "development",
      SPIORA_DEMO_MODE: "true",
    };
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(resolveCaseStoreBackend(process.env), "local");
  });
});

describe("client case submit lifecycle", () => {
  const ctx = {
    portalUserId: "portal-case-1",
    invitationId: "invite-case-1",
    portalEmail: "case-client@example.com",
    templateKey: "general_client_onboarding",
  };

  let previousCasesRaw: string | null = null;

  before(async () => {
    resetCaseStoreForTests();
    try {
      previousCasesRaw = await fs.readFile(CASES_FILE, "utf8");
    } catch {
      previousCasesRaw = null;
    }
    await fs.mkdir(path.dirname(CASES_FILE), { recursive: true });
    await fs.writeFile(
      CASES_FILE,
      JSON.stringify({
        cases: [],
        statusHistory: [],
        comments: [],
        activity: [],
        documents: [],
      }),
    );
  });

  after(async () => {
    if (previousCasesRaw == null) {
      try {
        await fs.unlink(CASES_FILE);
      } catch {
        /* ignore */
      }
      return;
    }
    await fs.writeFile(CASES_FILE, previousCasesRaw);
  });

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
          id: "q-case-1",
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
        if (record.status !== "draft") {
          return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" as const };
        }
        record = {
          ...record,
          answers: input.answers,
          revision: input.baseRevision + 1,
          lastSavedAt: input.lastSavedAt,
        };
        return { ok: true as const, record };
      },
      async setStatus(input: any) {
        if (!record || record.revision !== input.baseRevision) {
          return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" as const };
        }
        record = {
          ...record,
          status: input.status,
          reviewedAt:
            input.reviewedAt !== undefined ? input.reviewedAt : record.reviewedAt,
          submittedAt:
            input.submittedAt !== undefined
              ? input.submittedAt
              : record.submittedAt,
          revision: input.baseRevision + 1,
        };
        return { ok: true as const, record };
      },
    };
  }

  it("submits questionnaire, creates case, blocks duplicate and reopen", async () => {
    const store = makeStore();
    let draft = await saveQuestionnaireDraft(ctx, store as any, {
      baseRevision: null,
      operations: REQUIRED_OPS,
      locale: "en",
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;

    draft = await saveQuestionnaireDraft(ctx, store as any, {
      baseRevision: draft.revision,
      operations: REQUIRED_OPS,
      locale: "en",
    });

    const prepared = await prepareQuestionnaireSubmission(ctx, store as any, "en");
    assert.equal(prepared.ok, true);

    const first = await submitQuestionnaire(ctx, store as any, "en");
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.alreadySubmitted, false);
    assert.equal(first.record.status, "submitted");

    const caseStore = await createLocalCaseStore();
    const caseResult = await caseStore.submitCaseAtomically({
      questionnaireId: first.record.id,
      clientPortalUserId: first.record.clientPortalUserId,
      invitationId: first.record.invitationId,
      baseRevision: first.record.revision,
      assignedTo: "emp-1",
      serviceType: "consultation",
      firstName: "Ivan",
      lastName: "Ivanov",
      email: ctx.portalEmail,
      phone: "+3801234567",
      submittedAt: first.record.submittedAt ?? new Date().toISOString(),
    });
    assert.equal(caseResult.ok, true);
    if (!caseResult.ok) return;
    assert.equal(caseResult.created, true);

    const duplicateSubmit = await submitQuestionnaire(ctx, store as any, "en");
    assert.equal(duplicateSubmit.ok, true);
    if (duplicateSubmit.ok) assert.equal(duplicateSubmit.alreadySubmitted, true);

    const reopen = await reopenQuestionnaireDraft(ctx, store as any);
    assert.equal(reopen.ok, false);
    if (!reopen.ok) assert.equal(reopen.code, "QUESTIONNAIRE_ALREADY_SUBMITTED");

    const idempotentCase = await caseStore.submitCaseAtomically({
      questionnaireId: first.record.id,
      clientPortalUserId: first.record.clientPortalUserId,
      invitationId: first.record.invitationId,
      baseRevision: first.record.revision,
      assignedTo: "emp-1",
      serviceType: "consultation",
      firstName: "Ivan",
      lastName: "Ivanov",
      email: ctx.portalEmail,
      phone: "+3801234567",
      submittedAt: first.record.submittedAt ?? new Date().toISOString(),
    });
    assert.equal(idempotentCase.ok, true);
    if (idempotentCase.ok) {
      assert.equal(idempotentCase.created, false);
      assert.equal(idempotentCase.case.id, caseResult.case.id);
    }

    const intake = await listIntakeCases({ search: "Ivan" });
    assert.ok(intake.items.some((item) => item.id === caseResult.case.id));
    assert.ok(intake.pageSize <= 100);

    const comment = await addCaseComment({
      caseId: caseResult.case.id,
      authorUserId: "emp-1",
      authorName: "Anna Manager",
      body: "Internal note for specialists only",
    });
    assert.equal(comment.ok, true);

    const status = await changeCaseStatus({
      caseId: caseResult.case.id,
      toStatus: "initial_review",
      actorUserId: "emp-1",
      actorName: "Anna Manager",
    });
    assert.equal(status.ok, true);

    const portal = await getPortalCaseForUser(ctx.portalUserId);
    assert.ok(portal);
    assert.equal(portal?.currentStatus, "initial_review");
    assert.equal(caseStatusLabel(portal!.currentStatus, "ru"), "Первичная проверка");
    assert.ok(portal!.history.every((h) => "labelKey" in h));
    assert.equal("comments" in (portal as object), false);

    const detail = await getEmployeeCaseDetail(caseResult.case.id, "ru");
    assert.ok(detail);
    assert.ok(detail!.comments.some((c) => c.body.includes("Internal note")));
    assert.ok(detail!.comments.every((c) => c.visibility === "internal"));
    assert.ok(
      detail!.activity.some((a) => a.eventType === "questionnaire_submitted"),
    );

    const publicDto = toClientCasePublic(detail!.record, detail!.history);
    assert.ok(publicDto);
    assert.equal(
      JSON.stringify(publicDto).includes("Internal note"),
      false,
    );

    const doc = await addEmployeeCaseDocument({
      caseId: caseResult.case.id,
      fileName: "note.pdf",
      mimeType: "application/pdf",
      sizeBytes: 128,
      category: "employee",
      uploadedByUserId: "emp-1",
      uploadedByName: "Anna Manager",
      storagePath: `cases/${caseResult.case.id}/note.pdf`,
    });
    assert.equal(doc.ok, true);

    const refreshed = await getEmployeeCaseDetail(caseResult.case.id);
    assert.ok(refreshed!.employeeDocuments.some((d) => d.fileName === "note.pdf"));
    assert.ok(
      refreshed!.employeeDocuments.every((d) => d.visibility === "internal"),
    );
  });

  it("rejects incomplete submit", async () => {
    const store = makeStore();
    await saveQuestionnaireDraft(
      { ...ctx, invitationId: "invite-case-incomplete", portalUserId: "portal-case-2" },
      store as any,
      {
        baseRevision: null,
        operations: [{ op: "set", questionId: "first_name", value: "Only" }],
        locale: "en",
      },
    );
    const result = await submitQuestionnaire(
      { ...ctx, invitationId: "invite-case-incomplete", portalUserId: "portal-case-2" },
      store as any,
      "en",
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "QUESTIONNAIRE_VALIDATION_FAILED");
  });

  it("supports zip employee uploads and isolates cases", async () => {
    assert.equal(
      isAllowedCaseEmployeeDocument("pack.zip", "application/zip", 1024).ok,
      true,
    );
    const store = await createLocalCaseStore();
    const a = await store.submitCaseAtomically({
      questionnaireId: "q-iso-a",
      clientPortalUserId: "iso-a",
      invitationId: "inv-a",
      baseRevision: 1,
      assignedTo: null,
      serviceType: "consultation",
      firstName: "A",
      lastName: "One",
      email: "a@example.com",
      phone: null,
      submittedAt: new Date().toISOString(),
    });
    const b = await store.submitCaseAtomically({
      questionnaireId: "q-iso-b",
      clientPortalUserId: "iso-b",
      invitationId: "inv-b",
      baseRevision: 1,
      assignedTo: null,
      serviceType: "consultation",
      firstName: "B",
      lastName: "Two",
      email: "b@example.com",
      phone: null,
      submittedAt: new Date().toISOString(),
    });
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    await store.addComment({
      caseId: a.case.id,
      authorUserId: "emp",
      authorName: "Emp",
      body: "secret for A",
      visibility: "internal",
    });
    const commentsB = await store.listComments(b.case.id);
    assert.equal(commentsB.length, 0);
    const clientDocsB = await store.listDocuments(b.case.id, {
      includeInternal: false,
    });
    assert.equal(clientDocsB.length, 0);
  });

  it("paginates intake without loading unbounded pages", async () => {
    const store = await createLocalCaseStore();
    for (let i = 0; i < 3; i += 1) {
      await store.submitCaseAtomically({
        questionnaireId: `q-page-${i}`,
        clientPortalUserId: `portal-page-${i}`,
        invitationId: `inv-page-${i}`,
        baseRevision: 1,
        assignedTo: null,
        serviceType: "consultation",
        firstName: `P${i}`,
        lastName: "Page",
        email: `p${i}@example.com`,
        phone: null,
        submittedAt: new Date(Date.now() - i * 1000).toISOString(),
      });
    }
    const page = await store.listIntake({ page: 1, pageSize: 2 });
    assert.equal(page.items.length, 2);
    assert.ok(page.total >= 3);
    assert.equal(page.pageSize, 2);
  });
});
