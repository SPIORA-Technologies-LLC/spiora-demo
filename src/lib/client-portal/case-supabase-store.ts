import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientCaseActivityRecord,
  ClientCaseCommentRecord,
  ClientCaseRecord,
  ClientCaseStatus,
  ClientCaseStatusHistoryRecord,
} from "./case-types";
import { isClientCaseStatus } from "./case-types";
import type {
  CaseDocumentRecord,
  CaseStore,
  SubmitCaseAtomicallyInput,
  SubmitCaseAtomicallyResult,
} from "./case-store";

type DbCase = {
  id: string;
  client_portal_user_id: string;
  invitation_id: string;
  questionnaire_id: string;
  crm_client_id: string | null;
  assigned_to: string | null;
  service_type: string | null;
  current_status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  assigned_profile?: { display_name?: string | null } | null;
};

type DbHistory = {
  id: string;
  case_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  actor_role: string;
  client_visible_key: string | null;
  note: string | null;
  created_at: string;
};

type DbComment = {
  id: string;
  case_id: string;
  author_user_id: string | null;
  author_name: string;
  body: string;
  visibility: string;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
};

type DbActivity = {
  id: string;
  case_id: string;
  activity_type: string;
  actor_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DbDocument = {
  id: string;
  case_id: string;
  uploader_role: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  document_type: string | null;
  category: string | null;
  visibility: string;
  source_question_id: string | null;
  created_at: string;
  archived_at: string | null;
};

const CASE_SELECT =
  "id, client_portal_user_id, invitation_id, questionnaire_id, crm_client_id, assigned_to, service_type, current_status, first_name, last_name, email, phone, submitted_at, created_at, updated_at, archived_at, assigned_profile:user_profiles!client_cases_assigned_to_fkey(display_name)";

function mapCase(row: DbCase): ClientCaseRecord {
  const status = isClientCaseStatus(row.current_status)
    ? row.current_status
    : "application_received";
  return {
    id: row.id,
    clientPortalUserId: row.client_portal_user_id,
    invitationId: row.invitation_id,
    questionnaireId: row.questionnaire_id,
    crmClientId: row.crm_client_id,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_profile?.display_name ?? null,
    serviceType: row.service_type,
    currentStatus: status,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapHistory(row: DbHistory): ClientCaseStatusHistoryRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    fromStatus: row.from_status && isClientCaseStatus(row.from_status) ? row.from_status : null,
    toStatus: isClientCaseStatus(row.to_status) ? row.to_status : "application_received",
    actorUserId: row.changed_by,
    actorRole:
      row.actor_role === "employee" || row.actor_role === "client"
        ? row.actor_role
        : "system",
    clientVisibleKey: row.client_visible_key,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapComment(row: DbComment): ClientCaseCommentRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    body: row.body,
    visibility: row.visibility === "client" ? "client" : "internal",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    archivedAt: row.archived_at,
  };
}

function mapActivity(row: DbActivity): ClientCaseActivityRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    eventType: row.activity_type,
    actorUserId: row.actor_id,
    actorRole:
      row.actor_type === "employee" || row.actor_type === "client"
        ? row.actor_type
        : "system",
    payload: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapDocument(row: DbDocument): CaseDocumentRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    uploaderRole:
      row.uploader_role === "employee" || row.uploader_role === "system"
        ? row.uploader_role
        : "client",
    uploadedByUserId: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    documentType: row.document_type,
    category: row.category,
    visibility: row.visibility === "client" ? "client" : "internal",
    sourceQuestionId: row.source_question_id,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function createSupabaseCaseStore(client: SupabaseClient): CaseStore {
  return {
    async getById(id) {
      const { data, error } = await client
        .from("client_cases")
        .select(CASE_SELECT)
        .eq("id", id)
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCase(data as unknown as DbCase) : null;
    },

    async getByQuestionnaireId(questionnaireId) {
      const { data, error } = await client
        .from("client_cases")
        .select(CASE_SELECT)
        .eq("questionnaire_id", questionnaireId)
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCase(data as unknown as DbCase) : null;
    },

    async getByPortalUserId(portalUserId) {
      const { data, error } = await client
        .from("client_cases")
        .select(CASE_SELECT)
        .eq("client_portal_user_id", portalUserId)
        .is("archived_at", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCase(data as unknown as DbCase) : null;
    },

    async listIntake(input) {
      const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
      const page = Math.max(input.page ?? 1, 1);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const search = input.search?.trim() ?? "";

      let query = client
        .from("client_cases")
        .select(CASE_SELECT, { count: "exact" })
        .is("archived_at", null)
        .order("submitted_at", { ascending: false })
        .range(from, to);

      if (search) {
        const pattern = `%${search.replace(/[%_]/g, "")}%`;
        query = query.or(
          `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},service_type.ilike.${pattern}`,
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        items: (data ?? []).map((row) => mapCase(row as unknown as DbCase)),
        total: count ?? 0,
        page,
        pageSize,
      };
    },

    async submitCaseAtomically(
      input: SubmitCaseAtomicallyInput,
    ): Promise<SubmitCaseAtomicallyResult> {
      const { data, error } = await client.rpc("spiora_submit_client_case", {
        p_questionnaire_id: input.questionnaireId,
        p_portal_user_id: input.clientPortalUserId,
        p_invitation_id: input.invitationId,
        p_base_revision: input.baseRevision,
        p_assigned_to: input.assignedTo,
        p_service_type: input.serviceType,
        p_first_name: input.firstName,
        p_last_name: input.lastName,
        p_email: input.email,
        p_phone: input.phone,
        p_submitted_at: input.submittedAt,
        p_documents: input.clientDocuments ?? [],
      });

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("revision")) {
          return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
        }
        if (msg.includes("not found")) {
          return { ok: false, code: "QUESTIONNAIRE_NOT_FOUND" };
        }
        if (msg.includes("access") || msg.includes("denied")) {
          return { ok: false, code: "QUESTIONNAIRE_ACCESS_DENIED" };
        }
        if (msg.includes("read_only") || msg.includes("immutable")) {
          return { ok: false, code: "QUESTIONNAIRE_READ_ONLY" };
        }
        return { ok: false, code: "SUBMIT_FAILED" };
      }

      const payload = data as {
        ok?: boolean;
        created?: boolean;
        case_id?: string;
        code?: string;
        questionnaire_revision?: number;
        submitted_at?: string;
      } | null;

      if (!payload?.ok || !payload.case_id) {
        const code = payload?.code;
        if (code === "QUESTIONNAIRE_REVISION_CONFLICT") {
          return { ok: false, code };
        }
        if (code === "QUESTIONNAIRE_NOT_FOUND") {
          return { ok: false, code };
        }
        if (code === "QUESTIONNAIRE_ACCESS_DENIED") {
          return { ok: false, code };
        }
        if (code === "QUESTIONNAIRE_READ_ONLY") {
          return { ok: false, code };
        }
        return { ok: false, code: "SUBMIT_FAILED" };
      }

      const record = await this.getById(payload.case_id);
      if (!record) return { ok: false, code: "SUBMIT_FAILED" };
      return {
        ok: true,
        created: Boolean(payload.created),
        case: record,
        questionnaireStatus: "submitted",
        questionnaireRevision: payload.questionnaire_revision ?? input.baseRevision + 1,
        submittedAt: payload.submitted_at ?? record.submittedAt,
      };
    },

    async updateStatus(input) {
      const current = await this.getById(input.caseId);
      if (!current) return null;
      if (current.currentStatus === input.toStatus) return current;

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        current_status: input.toStatus,
        updated_at: now,
      };
      if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo;

      const { data, error } = await client
        .from("client_cases")
        .update(patch)
        .eq("id", input.caseId)
        .is("archived_at", null)
        .select(CASE_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      await client.from("client_case_status_history").insert({
        case_id: input.caseId,
        from_status: current.currentStatus,
        to_status: input.toStatus,
        changed_by: input.actorUserId,
        actor_role: input.actorRole,
        client_visible_key: input.toStatus,
        note: input.note ?? null,
      });
      await client.from("client_case_activity").insert({
        case_id: input.caseId,
        activity_type: "status_changed",
        actor_type: input.actorRole,
        actor_id: input.actorUserId,
        metadata: {
          fromStatus: current.currentStatus,
          toStatus: input.toStatus,
          note: input.note ?? null,
        },
      });

      return mapCase(data as unknown as DbCase);
    },

    async listStatusHistory(caseId) {
      const { data, error } = await client
        .from("client_case_status_history")
        .select(
          "id, case_id, from_status, to_status, changed_by, actor_role, client_visible_key, note, created_at",
        )
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapHistory(row as DbHistory));
    },

    async listComments(caseId) {
      const { data, error } = await client
        .from("client_case_comments")
        .select(
          "id, case_id, author_user_id, author_name, body, visibility, created_at, updated_at, archived_at",
        )
        .eq("case_id", caseId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapComment(row as DbComment));
    },

    async addComment(input) {
      const { data, error } = await client
        .from("client_case_comments")
        .insert({
          case_id: input.caseId,
          author_user_id: input.authorUserId,
          author_name: input.authorName,
          body: input.body.trim(),
          visibility: input.visibility ?? "internal",
        })
        .select(
          "id, case_id, author_user_id, author_name, body, visibility, created_at, updated_at, archived_at",
        )
        .single();
      if (error) throw error;
      const comment = mapComment(data as DbComment);
      await client.from("client_case_activity").insert({
        case_id: input.caseId,
        activity_type: "comment_added",
        actor_type: "employee",
        actor_id: input.authorUserId,
        metadata: { commentId: comment.id, visibility: comment.visibility },
      });
      return comment;
    },

    async listActivity(caseId) {
      const { data, error } = await client
        .from("client_case_activity")
        .select(
          "id, case_id, activity_type, actor_type, actor_id, metadata, created_at",
        )
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapActivity(row as DbActivity));
    },

    async appendActivity(input) {
      const { data, error } = await client
        .from("client_case_activity")
        .insert({
          case_id: input.caseId,
          activity_type: input.eventType,
          actor_type: input.actorRole,
          actor_id: input.actorUserId,
          metadata: input.payload ?? {},
        })
        .select(
          "id, case_id, activity_type, actor_type, actor_id, metadata, created_at",
        )
        .single();
      if (error) throw error;
      return mapActivity(data as DbActivity);
    },

    async listDocuments(caseId, opts) {
      let query = client
        .from("client_case_documents")
        .select(
          "id, case_id, uploader_role, uploaded_by, uploaded_by_name, file_name, mime_type, size_bytes, storage_bucket, storage_path, document_type, category, visibility, source_question_id, created_at, archived_at",
        )
        .eq("case_id", caseId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (opts?.includeInternal === false) {
        query = query.eq("visibility", "client");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => mapDocument(row as DbDocument));
    },

    async addDocument(input) {
      const { data, error } = await client
        .from("client_case_documents")
        .insert({
          case_id: input.caseId,
          uploader_role: input.uploaderRole,
          uploaded_by: input.uploadedByUserId,
          uploaded_by_name: input.uploadedByName,
          file_name: input.fileName,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          document_type: input.documentType ?? null,
          category: input.category ?? null,
          visibility: input.visibility,
          source_question_id: input.sourceQuestionId ?? null,
        })
        .select(
          "id, case_id, uploader_role, uploaded_by, uploaded_by_name, file_name, mime_type, size_bytes, storage_bucket, storage_path, document_type, category, visibility, source_question_id, created_at, archived_at",
        )
        .single();
      if (error) throw error;
      const document = mapDocument(data as DbDocument);
      await client.from("client_case_activity").insert({
        case_id: input.caseId,
        activity_type: "documents_uploaded",
        actor_type: input.uploaderRole === "client" ? "client" : "employee",
        actor_id: input.uploadedByUserId,
        metadata: {
          documentId: document.id,
          fileName: document.fileName,
          visibility: document.visibility,
        },
      });
      return document;
    },

    async getDocument(caseId, documentId) {
      const { data, error } = await client
        .from("client_case_documents")
        .select(
          "id, case_id, uploader_role, uploaded_by, uploaded_by_name, file_name, mime_type, size_bytes, storage_bucket, storage_path, document_type, category, visibility, source_question_id, created_at, archived_at",
        )
        .eq("case_id", caseId)
        .eq("id", documentId)
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDocument(data as DbDocument) : null;
    },

    async archiveDocument(caseId, documentId) {
      const { data, error } = await client
        .from("client_case_documents")
        .update({ archived_at: new Date().toISOString() })
        .eq("case_id", caseId)
        .eq("id", documentId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async archiveCase(caseId) {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("client_cases")
        .update({ archived_at: now, updated_at: now })
        .eq("id", caseId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  };
}
