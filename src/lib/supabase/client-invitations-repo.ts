import "server-only";

import { getSupabaseAdmin } from "./server";
import type { ClientPortalLocale } from "@/lib/client-portal/types";

export type ClientInvitationRow = {
  id: string;
  email: string;
  firstName: string | null;
  tokenHash: string;
  preferredLocale: ClientPortalLocale;
  serviceType: string | null;
  assignedTo: string | null;
  questionnaireTemplateKey: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  acceptedByUserId: string | null;
  createdBy: string;
  createRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

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

function mapRow(row: DbRow): ClientInvitationRow {
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

const SELECT =
  "id, email, first_name, token_hash, preferred_locale, service_type, assigned_to, questionnaire_template_key, expires_at, accepted_at, revoked_at, accepted_by_user_id, created_by, create_request_id, created_at, updated_at";

export async function sbListClientInvitations(): Promise<ClientInvitationRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DbRow[]).map(mapRow);
}

export async function sbGetInvitationByTokenHash(
  tokenHash: string,
): Promise<ClientInvitationRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .select(SELECT)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : null;
}

export async function sbGetInvitationById(
  id: string,
): Promise<ClientInvitationRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : null;
}

export async function sbGetInvitationByRequestId(
  createdBy: string,
  requestId: string,
): Promise<ClientInvitationRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .select(SELECT)
    .eq("created_by", createdBy)
    .eq("create_request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : null;
}

export async function sbInsertClientInvitation(input: {
  email: string;
  firstName?: string | null;
  tokenHash: string;
  preferredLocale: ClientPortalLocale;
  serviceType: string | null;
  assignedTo: string | null;
  questionnaireTemplateKey: string | null;
  expiresAt: string;
  createdBy: string;
  createRequestId: string | null;
}): Promise<ClientInvitationRow> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .insert({
      email: input.email,
      first_name: input.firstName ?? null,
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
}

export async function sbRotateInvitationToken(
  id: string,
  tokenHash: string,
): Promise<ClientInvitationRow | null> {
  const existing = await sbGetInvitationById(id);
  if (!existing) return null;
  if (existing.acceptedAt || existing.revokedAt) return null;
  if (new Date(existing.expiresAt).getTime() <= Date.now()) return null;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .update({
      token_hash: tokenHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : null;
}

export async function sbRevokeClientInvitation(
  id: string,
): Promise<ClientInvitationRow | null> {
  const existing = await sbGetInvitationById(id);
  if (!existing) return null;
  if (existing.acceptedAt) return existing;
  if (existing.revokedAt) return existing;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : existing;
}

/**
 * Accept invitation + create portal user.
 * Uses conditional update for race safety; retries idempotent path.
 */
export async function sbAcceptClientInvitation(input: {
  invitationId: string;
  authUserId: string;
  email: string;
  preferredLocale: ClientPortalLocale;
}): Promise<{ invitation: ClientInvitationRow; portalUserId: string }> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const existingPortal = await sb
    .from("client_portal_users")
    .select("id, invitation_id, auth_user_id, email")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (existingPortal.data) {
    if (existingPortal.data.invitation_id === input.invitationId) {
      const inv = await sbGetInvitationById(input.invitationId);
      if (!inv) throw new Error("invitation_not_found");
      return { invitation: inv, portalUserId: existingPortal.data.id as string };
    }

    // Re-invite after staff delete: portal row is soft-kept (hard delete blocked),
    // but invitation_id still points at the old (often staff-hidden) invite.
    // Same email + same Auth user → rebind to the new invitation.
    const portalEmail = String(existingPortal.data.email ?? "")
      .trim()
      .toLowerCase();
    if (portalEmail && portalEmail === input.email.trim().toLowerCase()) {
      return rebindPortalUserToInvitation({
        portalUserId: existingPortal.data.id as string,
        invitationId: input.invitationId,
        authUserId: input.authUserId,
        preferredLocale: input.preferredLocale,
        now,
      });
    }

    throw new Error("portal_user_other_invite");
  }

  const { data: updated, error: updErr } = await sb
    .from("client_invitations")
    .update({
      accepted_at: now,
      accepted_by_user_id: input.authUserId,
    })
    .eq("id", input.invitationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .select(SELECT)
    .maybeSingle();

  if (updErr) throw updErr;

  if (!updated) {
    const current = await sbGetInvitationById(input.invitationId);
    if (!current) throw new Error("invitation_not_found");
    if (current.revokedAt) throw new Error("invitation_revoked");
    if (current.acceptedAt) {
      if (current.acceptedByUserId === input.authUserId) {
        const portal = await sb
          .from("client_portal_users")
          .select("id")
          .eq("invitation_id", input.invitationId)
          .maybeSingle();
        if (portal.data?.id) {
          return {
            invitation: current,
            portalUserId: portal.data.id as string,
          };
        }
      }
      throw new Error("invitation_accepted");
    }
    if (new Date(current.expiresAt).getTime() <= Date.now()) {
      throw new Error("invitation_expired");
    }
    throw new Error("invitation_not_pending");
  }

  const { data: portal, error: portalErr } = await sb
    .from("client_portal_users")
    .insert({
      auth_user_id: input.authUserId,
      email: input.email,
      preferred_locale: input.preferredLocale,
      invitation_id: input.invitationId,
    })
    .select("id")
    .single();

  if (portalErr) {
    // Unique race / re-invite after Auth user recreate:
    // portal row still exists for this email (hard delete blocked) under an old auth_user_id.
    if (portalErr.code === "23505") {
      const again = await sb
        .from("client_portal_users")
        .select("id, invitation_id, email, auth_user_id")
        .eq("auth_user_id", input.authUserId)
        .maybeSingle();
      if (again.data?.id) {
        if (again.data.invitation_id === input.invitationId) {
          return {
            invitation: mapRow(updated as DbRow),
            portalUserId: again.data.id as string,
          };
        }
        const againEmail = String(again.data.email ?? "")
          .trim()
          .toLowerCase();
        if (againEmail && againEmail === input.email.trim().toLowerCase()) {
          return rebindPortalUserToInvitation({
            portalUserId: again.data.id as string,
            invitationId: input.invitationId,
            authUserId: input.authUserId,
            preferredLocale: input.preferredLocale,
            now,
          });
        }
      }

      const byEmail = await sb
        .from("client_portal_users")
        .select("id, invitation_id, email, auth_user_id")
        .eq("email", input.email.trim().toLowerCase())
        .maybeSingle();
      if (byEmail.data?.id) {
        const emailMatch =
          String(byEmail.data.email ?? "").trim().toLowerCase() ===
          input.email.trim().toLowerCase();
        if (emailMatch) {
          return rebindPortalUserToInvitation({
            portalUserId: byEmail.data.id as string,
            invitationId: input.invitationId,
            authUserId: input.authUserId,
            preferredLocale: input.preferredLocale,
            now,
            replaceAuthUserId: true,
          });
        }
      }
    }
    throw portalErr;
  }

  return {
    invitation: mapRow(updated as DbRow),
    portalUserId: portal.id as string,
  };
}

async function rebindPortalUserToInvitation(input: {
  portalUserId: string;
  invitationId: string;
  authUserId: string;
  preferredLocale: ClientPortalLocale;
  now: string;
  /** When Auth user was recreated, move portal identity onto the new auth uid. */
  replaceAuthUserId?: boolean;
}): Promise<{ invitation: ClientInvitationRow; portalUserId: string }> {
  const sb = getSupabaseAdmin();

  const { data: updated, error: updErr } = await sb
    .from("client_invitations")
    .update({
      accepted_at: input.now,
      accepted_by_user_id: input.authUserId,
    })
    .eq("id", input.invitationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", input.now)
    .select(SELECT)
    .maybeSingle();

  if (updErr) throw updErr;

  if (!updated) {
    const current = await sbGetInvitationById(input.invitationId);
    if (!current) throw new Error("invitation_not_found");
    if (current.revokedAt) throw new Error("invitation_revoked");
    if (current.acceptedAt) {
      if (current.acceptedByUserId === input.authUserId) {
        return { invitation: current, portalUserId: input.portalUserId };
      }
      throw new Error("invitation_accepted");
    }
    if (new Date(current.expiresAt).getTime() <= Date.now()) {
      throw new Error("invitation_expired");
    }
    throw new Error("invitation_not_pending");
  }

  const portalPatch: Record<string, unknown> = {
    invitation_id: input.invitationId,
    preferred_locale: input.preferredLocale,
    updated_at: input.now,
  };
  if (input.replaceAuthUserId) {
    portalPatch.auth_user_id = input.authUserId;
  }

  const { error: portalErr } = await sb
    .from("client_portal_users")
    .update(portalPatch)
    .eq("id", input.portalUserId);

  if (portalErr) throw portalErr;

  return {
    invitation: mapRow(updated as DbRow),
    portalUserId: input.portalUserId,
  };
}
