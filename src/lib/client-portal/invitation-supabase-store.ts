import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientPortalLocale } from "./types";
import type { InvitationRecord, InvitationStore } from "./invitation-types";

type DbRow = {
  id: string;
  email: string;
  first_name: string | null;
  token_hash: string;
  preferred_locale: string;
  service_type: string | null;
  assigned_to: string | null;
  questionnaire_template_key: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  accepted_by_user_id: string | null;
  created_by: string;
  create_request_id: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, email, first_name, token_hash, preferred_locale, service_type, assigned_to, questionnaire_template_key, expires_at, accepted_at, revoked_at, accepted_by_user_id, created_by, create_request_id, created_at, updated_at";

function mapRow(row: DbRow): InvitationRecord {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name?.trim() || null,
    tokenHash: row.token_hash,
    preferredLocale: row.preferred_locale === "en" ? "en" : "ru",
    serviceType: row.service_type,
    assignedTo: row.assigned_to,
    questionnaireTemplateKey: row.questionnaire_template_key,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    acceptedByUserId: row.accepted_by_user_id,
    createdBy: row.created_by,
    createRequestId: row.create_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseInvitationStore(
  client: SupabaseClient,
): InvitationStore {
  return {
    async findByRequestId(createdBy, requestId) {
      const { data, error } = await client
        .from("client_invitations")
        .select(SELECT)
        .eq("created_by", createdBy)
        .eq("create_request_id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as DbRow) : null;
    },

    async insert(input) {
      const { data, error } = await client
        .from("client_invitations")
        .insert({
          email: input.email,
          first_name: input.firstName,
          token_hash: input.tokenHash,
          preferred_locale: input.preferredLocale,
          service_type: input.serviceType,
          assigned_to: input.assignedTo,
          questionnaire_template_key: input.questionnaireTemplateKey,
          expires_at: input.expiresAt,
          created_by: input.createdBy,
          create_request_id: input.createRequestId,
        })
        .select(SELECT)
        .single();
      if (error) throw error;
      return mapRow(data as DbRow);
    },
  };
}

export function mapSupabaseAssigneeProfiles(
  profiles: Array<{ id: string; display_name: string; role: string }>,
) {
  return profiles
    .filter((p) => p.role === "owner" || p.role === "manager")
    .map((p) => ({
      id: p.id,
      name: p.display_name,
      role: p.role as "owner" | "manager",
    }));
}

export type { ClientPortalLocale };
