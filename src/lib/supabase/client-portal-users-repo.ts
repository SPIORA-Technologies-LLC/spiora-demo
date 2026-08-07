import "server-only";

import { getSupabaseAdmin } from "./server";
import type { ClientPortalLocale } from "@/lib/client-portal/types";

export type ClientPortalUserRow = {
  id: string;
  authUserId: string;
  email: string;
  preferredLocale: ClientPortalLocale;
  invitationId: string;
  mfaReenrollRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  id: string;
  auth_user_id: string;
  email: string;
  preferred_locale: string;
  invitation_id: string;
  mfa_reenroll_required?: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): ClientPortalUserRow {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    preferredLocale: row.preferred_locale === "en" ? "en" : "ru",
    invitationId: row.invitation_id,
    mfaReenrollRequired: Boolean(row.mfa_reenroll_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function sbGetClientPortalUserByAuthUserId(
  authUserId: string,
): Promise<ClientPortalUserRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_portal_users")
    .select(
      "id, auth_user_id, email, preferred_locale, invitation_id, mfa_reenroll_required, created_at, updated_at",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : null;
}

export async function sbGetClientPortalUserByEmail(
  email: string,
): Promise<ClientPortalUserRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_portal_users")
    .select(
      "id, auth_user_id, email, preferred_locale, invitation_id, mfa_reenroll_required, created_at, updated_at",
    )
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as DbRow) : null;
}
