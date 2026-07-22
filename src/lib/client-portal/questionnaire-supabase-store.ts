import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuestionnaireAnswers,
  QuestionnaireRecord,
  QuestionnaireSchema,
  TemplateVersionRecord,
} from "./questionnaire-types";
import type { QuestionnaireStore } from "./questionnaire-service";

type DbTemplateVersion = {
  id: string;
  template_id: string;
  version: number;
  schema: QuestionnaireSchema;
  schema_hash: string;
  status: string;
  published_at: string | null;
  created_at: string;
};

type DbQuestionnaire = {
  id: string;
  client_portal_user_id: string;
  invitation_id: string;
  template_version_id: string;
  status: string;
  answers: QuestionnaireAnswers;
  revision: number;
  started_at: string | null;
  last_saved_at: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const VERSION_SELECT =
  "id, template_id, version, schema, schema_hash, status, published_at, created_at";

const QUESTIONNAIRE_SELECT =
  "id, client_portal_user_id, invitation_id, template_version_id, status, answers, revision, started_at, last_saved_at, reviewed_at, submitted_at, created_at, updated_at, archived_at";

function mapVersion(row: DbTemplateVersion): TemplateVersionRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    schema: row.schema,
    schemaHash: row.schema_hash,
    status: row.status as TemplateVersionRecord["status"],
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

function mapQuestionnaire(row: DbQuestionnaire): QuestionnaireRecord {
  return {
    id: row.id,
    clientPortalUserId: row.client_portal_user_id,
    invitationId: row.invitation_id,
    templateVersionId: row.template_version_id,
    status: row.status as QuestionnaireRecord["status"],
    answers: row.answers ?? {},
    revision: row.revision,
    startedAt: row.started_at,
    lastSavedAt: row.last_saved_at,
    reviewedAt: row.reviewed_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export function createSupabaseQuestionnaireStore(
  client: SupabaseClient,
): QuestionnaireStore {
  return {
    async getPublishedVersionByTemplateKey(templateKey) {
      const { data: tmpl, error: tErr } = await client
        .from("questionnaire_templates")
        .select("id")
        .eq("template_key", templateKey)
        .eq("status", "published")
        .maybeSingle();
      if (tErr) throw tErr;
      if (!tmpl?.id) return null;

      const { data, error } = await client
        .from("questionnaire_template_versions")
        .select(VERSION_SELECT)
        .eq("template_id", tmpl.id)
        .eq("status", "published")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapVersion(data as DbTemplateVersion) : null;
    },

    async getPublishedVersionById(id) {
      const { data, error } = await client
        .from("questionnaire_template_versions")
        .select(VERSION_SELECT)
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data ? mapVersion(data as DbTemplateVersion) : null;
    },

    async getByInvitationId(invitationId) {
      const { data, error } = await client
        .from("client_questionnaires")
        .select(QUESTIONNAIRE_SELECT)
        .eq("invitation_id", invitationId)
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ? mapQuestionnaire(data as DbQuestionnaire) : null;
    },

    async getById(id) {
      const { data, error } = await client
        .from("client_questionnaires")
        .select(QUESTIONNAIRE_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapQuestionnaire(data as DbQuestionnaire) : null;
    },

    async createDraft(input) {
      const { data, error } = await client
        .from("client_questionnaires")
        .insert({
          client_portal_user_id: input.clientPortalUserId,
          invitation_id: input.invitationId,
          template_version_id: input.templateVersionId,
          status: "draft",
          answers: input.answers,
          revision: 1,
          started_at: input.startedAt,
          last_saved_at: input.startedAt,
        })
        .select(QUESTIONNAIRE_SELECT)
        .single();
      if (error) throw error;
      return mapQuestionnaire(data as DbQuestionnaire);
    },

    async updateDraft(input) {
      const { data, error } = await client
        .from("client_questionnaires")
        .update({
          answers: input.answers,
          revision: input.baseRevision + 1,
          last_saved_at: input.lastSavedAt,
          updated_at: input.lastSavedAt,
        })
        .eq("id", input.id)
        .eq("revision", input.baseRevision)
        .eq("status", "draft")
        .select(QUESTIONNAIRE_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
      }
      return { ok: true, record: mapQuestionnaire(data as DbQuestionnaire) };
    },

    async setStatus(input) {
      const patch: Record<string, unknown> = {
        status: input.status,
        revision: input.baseRevision + 1,
        updated_at: new Date().toISOString(),
      };
      if (input.reviewedAt !== undefined) {
        patch.reviewed_at = input.reviewedAt;
      }
      if (input.submittedAt !== undefined) {
        patch.submitted_at = input.submittedAt;
      }

      const { data, error } = await client
        .from("client_questionnaires")
        .update(patch)
        .eq("id", input.id)
        .eq("revision", input.baseRevision)
        .select(QUESTIONNAIRE_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
      }
      return { ok: true, record: mapQuestionnaire(data as DbQuestionnaire) };
    },
  };
}
