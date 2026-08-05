import "server-only";

import { randomUUID } from "node:crypto";
import { getCaseStore } from "./case-store-selection";
import {
  extractCaseSnapshotFromAnswers,
  nextCaseStatus,
  type ClientCasePublic,
  type ClientCaseIntakeItem,
  type ClientCaseStatus,
  isClientCaseStatus,
} from "./case-types";
import type { QuestionnaireRecord } from "./questionnaire-types";
import { isQuestionnaireFileAnswer } from "./questionnaire-attachment-formats";
import { createLocalQuestionnaireStore } from "./questionnaire-local-store";
import { createSupabaseQuestionnaireStore } from "./questionnaire-supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildReviewSections } from "./questionnaire-review";
import {
  resolvePublishedTemplateVersion,
  prepareQuestionnaireSubmission,
  submitQuestionnaire,
  type ClientQuestionnaireContext,
} from "./questionnaire-service";
import {
  CASE_DOCUMENT_BUCKET,
  questionnaireAttachmentStoragePath,
} from "./case-document-storage";
import type { CaseDocumentRecord } from "./case-store";

async function getQuestionnaireStore() {
  if (isSupabaseConfigured()) {
    return createSupabaseQuestionnaireStore(getSupabaseAdmin());
  }
  return createLocalQuestionnaireStore();
}

export function toClientCasePublic(
  record: Awaited<ReturnType<Awaited<ReturnType<typeof getCaseStore>>["getById"]>>,
  history: Awaited<
    ReturnType<Awaited<ReturnType<typeof getCaseStore>>["listStatusHistory"]>
  >,
): ClientCasePublic | null {
  if (!record) return null;
  return {
    id: record.id,
    currentStatus: record.currentStatus,
    submittedAt: record.submittedAt,
    serviceType: record.serviceType,
    nextStep: nextCaseStatus(record.currentStatus),
    history: history.map((item) => ({
      id: item.id,
      toStatus: item.toStatus,
      createdAt: item.createdAt,
      labelKey: item.clientVisibleKey ?? item.toStatus,
    })),
  };
}

export async function getPortalCaseForUser(portalUserId: string) {
  const store = await getCaseStore();
  const record = await store.getByPortalUserId(portalUserId);
  if (!record) return null;
  const history = await store.listStatusHistory(record.id);
  return toClientCasePublic(record, history);
}

function collectClientDocumentLinks(
  questionnaire: QuestionnaireRecord,
  schemaSections: Array<{
    questions: Array<{ id: string; type: string; label: { en: string; ru: string } }>;
  }>,
  locale: "en" | "ru",
) {
  const docs: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageBucket: string;
    storagePath: string;
    documentType: string | null;
    category: string | null;
    sourceQuestionId: string | null;
  }> = [];

  for (const section of schemaSections) {
    for (const question of section.questions) {
      if (question.type !== "file") continue;
      const value = questionnaire.answers[question.id];
      if (!isQuestionnaireFileAnswer(value)) continue;
      const storagePath = questionnaireAttachmentStoragePath(
        questionnaire.invitationId,
        value.id,
        value.fileName,
      );
      docs.push({
        fileName: value.fileName,
        mimeType: value.mimeType,
        sizeBytes: value.sizeBytes,
        storageBucket: CASE_DOCUMENT_BUCKET,
        storagePath,
        documentType: "questionnaire_attachment",
        category: question.label[locale] || question.id,
        sourceQuestionId: question.id,
      });
    }
  }
  return docs;
}

/**
 * Validate server-side, then create case atomically.
 * Supabase: RPC flips questionnaire + inserts case in one transaction.
 * Local/dev: setStatus then local atomic helper (tests only).
 */
export async function submitQuestionnaireAndCreateCase(
  ctx: ClientQuestionnaireContext,
  locale: "en" | "ru",
  assignedTo: string | null,
) {
  const qStore = await getQuestionnaireStore();
  const prepared = await prepareQuestionnaireSubmission(
    { ...ctx },
    qStore,
    locale,
  );
  if (!prepared.ok) return prepared;

  const snapshot = extractCaseSnapshotFromAnswers(
    prepared.record.answers,
    ctx.portalEmail,
  );
  const clientDocuments = collectClientDocumentLinks(
    prepared.record,
    prepared.schema.sections,
    locale,
  );
  const caseStore = await getCaseStore();
  const submittedAt = prepared.record.submittedAt ?? new Date().toISOString();

  if (isSupabaseConfigured()) {
    const atomic = await caseStore.submitCaseAtomically({
      questionnaireId: prepared.record.id,
      clientPortalUserId: prepared.record.clientPortalUserId,
      invitationId: prepared.record.invitationId,
      baseRevision: prepared.record.revision,
      assignedTo,
      serviceType: snapshot.serviceType,
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      email: snapshot.email,
      phone: snapshot.phone,
      submittedAt,
      clientDocuments,
    });

    if (!atomic.ok) {
      if (prepared.alreadySubmitted) {
        const existing = await caseStore.getByQuestionnaireId(prepared.record.id);
        if (existing) {
          void import("./case-crm-link").then(({ ensureCrmClientForIntakeCase }) =>
            ensureCrmClientForIntakeCase(existing.id, {
              actorUserId: existing.assignedTo,
              actorName: existing.assignedName,
            }),
          );
          return {
            ok: true as const,
            record: prepared.record,
            alreadySubmitted: true,
            caseId: existing.id,
            caseCreated: false,
            caseStatus: existing.currentStatus,
            submittedAt: existing.submittedAt,
          };
        }
      }
      return { ok: false as const, code: atomic.code };
    }

    const refreshed = await qStore.getById(prepared.record.id);
    void import("./invitation-case-names").then(({ syncInvitationFirstNameFromCase }) =>
      syncInvitationFirstNameFromCase(
        prepared.record.invitationId,
        snapshot.firstName,
      ),
    );
    void import("./case-crm-link").then(({ ensureCrmClientForIntakeCase }) =>
      ensureCrmClientForIntakeCase(atomic.case.id, {
        actorUserId: assignedTo,
        actorName: atomic.case.assignedName,
      }),
    );
    return {
      ok: true as const,
      record: refreshed ?? prepared.record,
      alreadySubmitted: prepared.alreadySubmitted || !atomic.created,
      caseId: atomic.case.id,
      caseCreated: atomic.created,
      caseStatus: atomic.case.currentStatus,
      submittedAt: atomic.submittedAt,
    };
  }

  // Local/dev: flip questionnaire then create case
  let record = prepared.record;
  if (!prepared.alreadySubmitted) {
    const submitted = await submitQuestionnaire(ctx, qStore, locale);
    if (!submitted.ok) return submitted;
    record = submitted.record;
  }

  const atomic = await caseStore.submitCaseAtomically({
    questionnaireId: record.id,
    clientPortalUserId: record.clientPortalUserId,
    invitationId: record.invitationId,
    baseRevision: record.revision,
    assignedTo,
    serviceType: snapshot.serviceType,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    email: snapshot.email,
    phone: snapshot.phone,
    submittedAt: record.submittedAt ?? submittedAt,
    clientDocuments,
  });

  if (!atomic.ok) {
    return { ok: false as const, code: atomic.code };
  }

  void import("./invitation-case-names").then(({ syncInvitationFirstNameFromCase }) =>
    syncInvitationFirstNameFromCase(record.invitationId, snapshot.firstName),
  );
  void import("./case-crm-link").then(({ ensureCrmClientForIntakeCase }) =>
    ensureCrmClientForIntakeCase(atomic.case.id, {
      actorUserId: assignedTo,
      actorName: atomic.case.assignedName,
    }),
  );

  return {
    ok: true as const,
    record,
    alreadySubmitted: prepared.alreadySubmitted || !atomic.created,
    caseId: atomic.case.id,
    caseCreated: atomic.created,
    caseStatus: atomic.case.currentStatus,
    submittedAt: atomic.submittedAt,
  };
}

export async function listIntakeCases(input?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ClientCaseIntakeItem[]; total: number; page: number; pageSize: number }> {
  const store = await getCaseStore();
  const page = await store.listIntake({
    search: input?.search,
    page: input?.page,
    pageSize: input?.pageSize,
  });
  return {
    items: page.items.map((item) => ({
      id: item.id,
      firstName: item.firstName ?? "—",
      lastName: item.lastName ?? "—",
      email: item.email ?? "—",
      serviceType: item.serviceType,
      submittedAt: item.submittedAt,
      assignedName: item.assignedName,
      currentStatus: item.currentStatus,
      crmClientId: item.crmClientId,
      questionnaireId: item.questionnaireId,
    })),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

export async function archiveIntakeCase(caseId: string): Promise<boolean> {
  const store = await getCaseStore();
  return store.archiveCase(caseId);
}

export async function getEmployeeCaseDetail(caseId: string, locale: "en" | "ru" = "en") {
  const store = await getCaseStore();
  const record = await store.getById(caseId);
  if (!record) return null;
  const [history, comments, activity, documents] = await Promise.all([
    store.listStatusHistory(caseId),
    store.listComments(caseId),
    store.listActivity(caseId),
    store.listDocuments(caseId, { includeInternal: true }),
  ]);

  const qStore = await getQuestionnaireStore();
  const questionnaire = await qStore.getById(record.questionnaireId);
  let reviewSections: ReturnType<typeof buildReviewSections> = [];

  if (questionnaire) {
    const version = await qStore.getPublishedVersionById(questionnaire.templateVersionId);
    if (version) {
      const resolved = resolvePublishedTemplateVersion(version);
      if (resolved) {
        reviewSections = buildReviewSections(resolved.schema, questionnaire.answers, locale);
      }
    }
  }

  const clientDocuments = documents.filter((d) => d.uploaderRole === "client");
  const employeeDocuments = documents.filter((d) => d.uploaderRole === "employee");

  return {
    record,
    history,
    comments,
    activity,
    clientDocuments,
    employeeDocuments,
    documents,
    questionnaire: questionnaire
      ? {
          id: questionnaire.id,
          status: questionnaire.status,
          submittedAt: questionnaire.submittedAt,
          revision: questionnaire.revision,
        }
      : null,
    reviewSections,
  };
}

export async function changeCaseStatus(input: {
  caseId: string;
  toStatus: string;
  actorUserId: string;
  actorName: string;
  note?: string | null;
}) {
  if (!isClientCaseStatus(input.toStatus)) {
    return { ok: false as const, code: "INVALID_STATUS" };
  }
  const store = await getCaseStore();
  const updated = await store.updateStatus({
    caseId: input.caseId,
    toStatus: input.toStatus as ClientCaseStatus,
    actorUserId: input.actorUserId,
    actorRole: "employee",
    note: input.note ?? null,
  });
  if (!updated) return { ok: false as const, code: "NOT_FOUND" };
  return { ok: true as const, case: updated };
}

export async function addCaseComment(input: {
  caseId: string;
  authorUserId: string;
  authorName: string;
  body: string;
}) {
  const body = input.body.trim();
  if (!body || body.length > 8000) {
    return { ok: false as const, code: "INVALID_BODY" };
  }
  const store = await getCaseStore();
  const existing = await store.getById(input.caseId);
  if (!existing) return { ok: false as const, code: "NOT_FOUND" };
  const comment = await store.addComment({
    caseId: input.caseId,
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    body,
    visibility: "internal",
  });
  return { ok: true as const, comment };
}

export async function addEmployeeCaseDocument(input: {
  caseId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category?: string | null;
  uploadedByUserId: string | null;
  uploadedByName: string;
  storagePath: string;
  storageBucket?: string;
}): Promise<{ ok: true; document: CaseDocumentRecord } | { ok: false; code: "NOT_FOUND" }> {
  const store = await getCaseStore();
  const existing = await store.getById(input.caseId);
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  const document = await store.addDocument({
    caseId: input.caseId,
    uploaderRole: "employee",
    uploadedByUserId: input.uploadedByUserId,
    uploadedByName: input.uploadedByName,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storageBucket: input.storageBucket ?? CASE_DOCUMENT_BUCKET,
    storagePath: input.storagePath,
    category: input.category ?? null,
    documentType: "employee_upload",
    visibility: "internal",
  });
  return { ok: true, document };
}

export async function getCaseDocument(caseId: string, documentId: string) {
  const store = await getCaseStore();
  return store.getDocument(caseId, documentId);
}

export async function archiveCaseDocument(
  caseId: string,
  documentId: string,
): Promise<boolean> {
  const store = await getCaseStore();
  return store.archiveDocument(caseId, documentId);
}

export function newCaseDocumentStorageKey(caseId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  return `cases/${caseId}/${randomUUID()}-${safe}`;
}
