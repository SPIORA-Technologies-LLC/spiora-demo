import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ClientCaseActivityRecord,
  ClientCaseCommentRecord,
  ClientCaseRecord,
  ClientCaseStatusHistoryRecord,
} from "./case-types";
import type {
  CaseDocumentRecord,
  CaseStore,
  SubmitCaseAtomicallyInput,
  SubmitCaseAtomicallyResult,
} from "./case-store";

const DATA_DIR = path.join(process.cwd(), ".data");
const CASES_FILE = path.join(DATA_DIR, "client-cases.json");

type LocalCaseStore = {
  cases: ClientCaseRecord[];
  statusHistory: ClientCaseStatusHistoryRecord[];
  comments: ClientCaseCommentRecord[];
  activity: ClientCaseActivityRecord[];
  documents: CaseDocumentRecord[];
};

async function readStore(): Promise<LocalCaseStore> {
  try {
    const raw = await fs.readFile(CASES_FILE, "utf8");
    const parsed = JSON.parse(raw) as LocalCaseStore & {
      employeeDocuments?: CaseDocumentRecord[];
    };
    return {
      cases: parsed.cases ?? [],
      statusHistory: parsed.statusHistory ?? [],
      comments: parsed.comments ?? [],
      activity: parsed.activity ?? [],
      documents: parsed.documents ?? parsed.employeeDocuments ?? [],
    };
  } catch {
    return {
      cases: [],
      statusHistory: [],
      comments: [],
      activity: [],
      documents: [],
    };
  }
}

async function writeStore(store: LocalCaseStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CASES_FILE, JSON.stringify(store, null, 2), "utf8");
}

/** Local/dev/test fallback only — never selected in production. */
export async function createLocalCaseStore(): Promise<CaseStore> {
  return {
    async getById(id) {
      const store = await readStore();
      return store.cases.find((item) => item.id === id && !item.archivedAt) ?? null;
    },

    async getByQuestionnaireId(questionnaireId) {
      const store = await readStore();
      return (
        store.cases.find(
          (item) => item.questionnaireId === questionnaireId && !item.archivedAt,
        ) ?? null
      );
    },

    async getByPortalUserId(portalUserId) {
      const store = await readStore();
      return (
        store.cases.find(
          (item) => item.clientPortalUserId === portalUserId && !item.archivedAt,
        ) ?? null
      );
    },

    async listIntake(input) {
      const store = await readStore();
      const q = input.search?.trim().toLowerCase() ?? "";
      const filtered = store.cases
        .filter((item) => !item.archivedAt)
        .filter((item) => {
          if (!q) return true;
          const hay = [
            item.firstName,
            item.lastName,
            item.email,
            item.serviceType,
            item.assignedName,
            item.currentStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
      const page = Math.max(input.page ?? 1, 1);
      const start = (page - 1) * pageSize;
      return {
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
      };
    },

    async submitCaseAtomically(
      input: SubmitCaseAtomicallyInput,
    ): Promise<SubmitCaseAtomicallyResult> {
      const store = await readStore();
      const existing = store.cases.find(
        (item) =>
          item.questionnaireId === input.questionnaireId && !item.archivedAt,
      );
      if (existing) {
        return {
          ok: true,
          created: false,
          case: existing,
          questionnaireStatus: "submitted",
          questionnaireRevision: input.baseRevision,
          submittedAt: existing.submittedAt,
        };
      }

      const now = input.submittedAt;
      const record: ClientCaseRecord = {
        id: randomUUID(),
        clientPortalUserId: input.clientPortalUserId,
        invitationId: input.invitationId,
        questionnaireId: input.questionnaireId,
        crmClientId: null,
        assignedTo: input.assignedTo,
        assignedName: null,
        serviceType: input.serviceType,
        currentStatus: "application_received",
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      store.cases.push(record);
      store.statusHistory.push({
        id: randomUUID(),
        caseId: record.id,
        fromStatus: null,
        toStatus: "application_received",
        actorUserId: null,
        actorRole: "system",
        clientVisibleKey: "application_received",
        note: null,
        createdAt: now,
      });
      store.activity.push({
        id: randomUUID(),
        caseId: record.id,
        eventType: "questionnaire_submitted",
        actorUserId: null,
        actorRole: "client",
        payload: { questionnaireId: input.questionnaireId },
        createdAt: now,
      });
      if (input.assignedTo) {
        store.activity.push({
          id: randomUUID(),
          caseId: record.id,
          eventType: "employee_assigned",
          actorUserId: input.assignedTo,
          actorRole: "system",
          payload: {},
          createdAt: now,
        });
      }
      for (const doc of input.clientDocuments ?? []) {
        store.documents.push({
          id: randomUUID(),
          caseId: record.id,
          uploaderRole: "client",
          uploadedByUserId: input.clientPortalUserId,
          uploadedByName: null,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          storageBucket: doc.storageBucket,
          storagePath: doc.storagePath,
          documentType: doc.documentType ?? null,
          category: doc.category ?? null,
          visibility: "client",
          sourceQuestionId: doc.sourceQuestionId ?? null,
          createdAt: now,
          archivedAt: null,
        });
      }
      await writeStore(store);
      return {
        ok: true,
        created: true,
        case: record,
        questionnaireStatus: "submitted",
        questionnaireRevision: input.baseRevision + 1,
        submittedAt: now,
      };
    },

    async updateStatus(input) {
      const store = await readStore();
      const idx = store.cases.findIndex(
        (item) => item.id === input.caseId && !item.archivedAt,
      );
      if (idx < 0) return null;
      const current = store.cases[idx]!;
      if (current.currentStatus === input.toStatus) return current;
      const now = new Date().toISOString();
      const updated: ClientCaseRecord = {
        ...current,
        currentStatus: input.toStatus,
        assignedTo:
          input.assignedTo !== undefined ? input.assignedTo : current.assignedTo,
        updatedAt: now,
      };
      store.cases[idx] = updated;
      store.statusHistory.push({
        id: randomUUID(),
        caseId: current.id,
        fromStatus: current.currentStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        clientVisibleKey: input.toStatus,
        note: input.note ?? null,
        createdAt: now,
      });
      store.activity.push({
        id: randomUUID(),
        caseId: current.id,
        eventType: "status_changed",
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        payload: {
          fromStatus: current.currentStatus,
          toStatus: input.toStatus,
          note: input.note ?? null,
        },
        createdAt: now,
      });
      await writeStore(store);
      return updated;
    },

    async listStatusHistory(caseId) {
      const store = await readStore();
      return store.statusHistory
        .filter((item) => item.caseId === caseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listComments(caseId) {
      const store = await readStore();
      return store.comments
        .filter((item) => item.caseId === caseId && !item.archivedAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async addComment(input) {
      const store = await readStore();
      const now = new Date().toISOString();
      const record: ClientCaseCommentRecord = {
        id: randomUUID(),
        caseId: input.caseId,
        authorUserId: input.authorUserId,
        authorName: input.authorName,
        body: input.body.trim(),
        visibility: input.visibility ?? "internal",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      store.comments.push(record);
      store.activity.push({
        id: randomUUID(),
        caseId: input.caseId,
        eventType: "comment_added",
        actorUserId: input.authorUserId,
        actorRole: "employee",
        payload: { commentId: record.id, visibility: record.visibility },
        createdAt: now,
      });
      await writeStore(store);
      return record;
    },

    async listActivity(caseId) {
      const store = await readStore();
      return store.activity
        .filter((item) => item.caseId === caseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async appendActivity(input) {
      const store = await readStore();
      const record: ClientCaseActivityRecord = {
        id: randomUUID(),
        caseId: input.caseId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        payload: input.payload ?? {},
        createdAt: new Date().toISOString(),
      };
      store.activity.push(record);
      await writeStore(store);
      return record;
    },

    async listDocuments(caseId, opts) {
      const store = await readStore();
      const includeInternal = opts?.includeInternal !== false;
      return store.documents
        .filter((item) => item.caseId === caseId && !item.archivedAt)
        .filter((item) => includeInternal || item.visibility === "client")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async addDocument(input) {
      const store = await readStore();
      const now = new Date().toISOString();
      const record: CaseDocumentRecord = {
        id: randomUUID(),
        caseId: input.caseId,
        uploaderRole: input.uploaderRole,
        uploadedByUserId: input.uploadedByUserId,
        uploadedByName: input.uploadedByName,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        documentType: input.documentType ?? null,
        category: input.category ?? null,
        visibility: input.visibility,
        sourceQuestionId: input.sourceQuestionId ?? null,
        createdAt: now,
        archivedAt: null,
      };
      store.documents.push(record);
      store.activity.push({
        id: randomUUID(),
        caseId: input.caseId,
        eventType: "documents_uploaded",
        actorUserId: input.uploadedByUserId,
        actorRole: input.uploaderRole === "client" ? "client" : "employee",
        payload: {
          documentId: record.id,
          fileName: record.fileName,
          visibility: record.visibility,
        },
        createdAt: now,
      });
      await writeStore(store);
      return record;
    },

    async getDocument(caseId, documentId) {
      const store = await readStore();
      return (
        store.documents.find(
          (item) =>
            item.caseId === caseId && item.id === documentId && !item.archivedAt,
        ) ?? null
      );
    },

    async archiveDocument(caseId, documentId) {
      const store = await readStore();
      const idx = store.documents.findIndex(
        (item) => item.caseId === caseId && item.id === documentId && !item.archivedAt,
      );
      if (idx < 0) return false;
      store.documents[idx] = {
        ...store.documents[idx]!,
        archivedAt: new Date().toISOString(),
      };
      await writeStore(store);
      return true;
    },

    async archiveCase(caseId) {
      const store = await readStore();
      const idx = store.cases.findIndex(
        (item) => item.id === caseId && !item.archivedAt,
      );
      if (idx < 0) return false;
      const now = new Date().toISOString();
      store.cases[idx] = {
        ...store.cases[idx]!,
        archivedAt: now,
        updatedAt: now,
      };
      await writeStore(store);
      return true;
    },

    async linkCrmClient(caseId, crmClientId) {
      const store = await readStore();
      const idx = store.cases.findIndex(
        (item) => item.id === caseId && !item.archivedAt,
      );
      if (idx < 0) return null;
      const current = store.cases[idx]!;
      if (current.crmClientId) {
        if (current.crmClientId === crmClientId) return current;
        throw new Error("CASE_CRM_ALREADY_LINKED");
      }
      store.cases[idx] = {
        ...current,
        crmClientId,
        updatedAt: new Date().toISOString(),
      };
      await writeStore(store);
      return store.cases[idx]!;
    },
  };
}
