import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeInviteEmail } from "./invite-token";

const MIN_PASSWORD_LEN = 8;

/**
 * Create or update a confirmed Supabase Auth user for the client portal.
 * Used when staff issues a temporary password with an invitation.
 *
 * Staff "delete" only hides the invitation — Auth + client_portal_users remain.
 * Re-invite must reset the password on the existing Auth user.
 */
export async function provisionClientPortalAuthUser(input: {
  email: string;
  password: string;
  firstName?: string | null;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "AUTH_UNAVAILABLE" };
  }

  const email = normalizeInviteEmail(input.email);
  if (!email) return { ok: false, code: "INVALID_EMAIL" };
  if (input.password.length < MIN_PASSWORD_LEN) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  const firstName =
    typeof input.firstName === "string" ? input.firstName.trim().slice(0, 80) : "";
  const userMetadata = firstName ? { first_name: firstName } : undefined;

  const admin = getSupabaseAdmin();

  // Prefer the portal row's auth_user_id (stable after staff delete / invite-again).
  // listUsers pagination alone is flaky once the Auth directory grows.
  const knownAuthId = await findPortalAuthUserIdByEmail(email);
  if (knownAuthId) {
    const { error: updateKnownError } = await admin.auth.admin.updateUserById(
      knownAuthId,
      {
        email_confirm: true,
        password: input.password,
        ...(userMetadata ? { user_metadata: userMetadata } : {}),
      },
    );
    if (!updateKnownError) {
      return { ok: true };
    }
    // Auth user missing (hard-deleted) — fall through to create / email lookup.
  }

  const existingId = knownAuthId
    ? null
    : await findAuthUserIdByEmail(email);

  if (existingId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(
      existingId,
      {
        email_confirm: true,
        password: input.password,
        ...(userMetadata ? { user_metadata: userMetadata } : {}),
      },
    );
    if (updateError) {
      return { ok: false, code: "AUTH_PROVISION_FAILED" };
    }
    return { ok: true };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (!createError) {
    return { ok: true };
  }

  const message = createError.message.toLowerCase();
  const alreadyExists =
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists");

  if (!alreadyExists) {
    return { ok: false, code: "AUTH_PROVISION_FAILED" };
  }

  // Race / soft-deleted: create said exists — resolve id and update password.
  const racedId = await findAuthUserIdByEmail(email);
  if (!racedId) {
    return { ok: false, code: "AUTH_PROVISION_FAILED" };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    racedId,
    {
      email_confirm: true,
      password: input.password,
      ...(userMetadata ? { user_metadata: userMetadata } : {}),
    },
  );

  if (updateError) {
    return { ok: false, code: "AUTH_PROVISION_FAILED" };
  }

  return { ok: true };
}

async function findPortalAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_portal_users")
    .select("auth_user_id")
    .eq("email", email)
    .maybeSingle();
  if (error || !data?.auth_user_id) return null;
  return String(data.auth_user_id);
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return null;
    const match = data.users.find(
      (u) => u.email?.trim().toLowerCase() === normalized,
    );
    if (match?.id) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}
