/**
 * Framework-agnostic case persistence interface (PR #32.1).
 * Services depend on this contract — never on JSON or Supabase directly.
 */

import type {
  ClientCaseActivityRecord,
  ClientCaseCommentRecord,
  ClientCaseRecord,
  ClientCaseStatus,
  ClientCaseStatusHistoryRecord,
} from "./case-types";

export type CaseDocumentVisibility = "client" | "internal";

export type CaseDocumentRecord = {
  id: string;
  caseId: string;
  uploaderRole: "client" | "employee" | "system";
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  documentType: string | null;
  category: string | null;
  visibility: CaseDocumentVisibility;
  sourceQuestionId: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type CaseIntakePage = {
  items: ClientCaseRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type SubmitCaseAtomicallyInput = {
  questionnaireId: string;
  clientPortalUserId: string;
  invitationId: string;
  baseRevision: number;
  assignedTo: string | null;
  serviceType: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  submittedAt: string;
  /** Client questionnaire attachment metadata to link (no binary copy). */
  clientDocuments?: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageBucket: string;
    storagePath: string;
    documentType?: string | null;
    category?: string | null;
    sourceQuestionId?: string | null;
  }>;
};

export type SubmitCaseAtomicallyResult =
  | {
      ok: true;
      created: boolean;
      case: ClientCaseRecord;
      questionnaireStatus: "submitted";
      questionnaireRevision: number;
      submittedAt: string;
    }
  | {
      ok: false;
      code:
        | "QUESTIONNAIRE_NOT_FOUND"
        | "QUESTIONNAIRE_ACCESS_DENIED"
        | "QUESTIONNAIRE_REVISION_CONFLICT"
        | "QUESTIONNAIRE_READ_ONLY"
        | "SUBMIT_FAILED";
    };

export type CaseStore = {
  getById(id: string): Promise<ClientCaseRecord | null>;
  getByQuestionnaireId(questionnaireId: string): Promise<ClientCaseRecord | null>;
  getByPortalUserId(portalUserId: string): Promise<ClientCaseRecord | null>;
  listIntake(input: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CaseIntakePage>;
  /**
   * Atomic submit: questionnaire → submitted + case + history + activity + doc links.
   * Must be transactional in production (RPC / single DB transaction).
   */
  submitCaseAtomically(
    input: SubmitCaseAtomicallyInput,
  ): Promise<SubmitCaseAtomicallyResult>;
  updateStatus(input: {
    caseId: string;
    toStatus: ClientCaseStatus;
    actorUserId: string | null;
    actorRole: "employee" | "client" | "system";
    note?: string | null;
    assignedTo?: string | null;
  }): Promise<ClientCaseRecord | null>;
  listStatusHistory(caseId: string): Promise<ClientCaseStatusHistoryRecord[]>;
  listComments(caseId: string): Promise<ClientCaseCommentRecord[]>;
  addComment(input: {
    caseId: string;
    authorUserId: string | null;
    authorName: string;
    body: string;
    visibility?: "internal" | "client";
  }): Promise<ClientCaseCommentRecord>;
  listActivity(caseId: string): Promise<ClientCaseActivityRecord[]>;
  appendActivity(input: {
    caseId: string;
    eventType: string;
    actorUserId: string | null;
    actorRole: "employee" | "client" | "system";
    payload?: Record<string, unknown>;
  }): Promise<ClientCaseActivityRecord>;
  listDocuments(
    caseId: string,
    opts?: { includeInternal?: boolean },
  ): Promise<CaseDocumentRecord[]>;
  addDocument(input: {
    caseId: string;
    uploaderRole: "client" | "employee" | "system";
    uploadedByUserId: string | null;
    uploadedByName: string | null;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageBucket: string;
    storagePath: string;
    documentType?: string | null;
    category?: string | null;
    visibility: CaseDocumentVisibility;
    sourceQuestionId?: string | null;
  }): Promise<CaseDocumentRecord>;
  getDocument(
    caseId: string,
    documentId: string,
  ): Promise<CaseDocumentRecord | null>;
  archiveDocument(caseId: string, documentId: string): Promise<boolean>;
  /** Soft-delete from staff intake list (sets archived_at). */
  archiveCase(caseId: string): Promise<boolean>;
  /**
   * Link case to CRM client uuid (clients.id). Idempotent when already linked
   * to the same id; refuses overwrite to a different client.
   */
  linkCrmClient(
    caseId: string,
    crmClientId: string,
  ): Promise<ClientCaseRecord | null>;
};

export class CaseStoreConfigurationError extends Error {
  readonly code = "CASE_STORE_MISCONFIGURED";
  constructor(message: string) {
    super(message);
    this.name = "CaseStoreConfigurationError";
  }
}

export function isProductionLikeRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "production" || env.VERCEL === "1";
}
