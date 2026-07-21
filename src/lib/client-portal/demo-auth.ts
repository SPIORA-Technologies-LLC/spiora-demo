import "server-only";

import { isDemoMode } from "@/lib/demo/demo-mode";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeInviteEmail } from "./invite-token";

const MIN_PASSWORD_LEN = 8;

/**
 * Demo-only: skip email confirmation for client portal registration.
 * Requires SPIORA_DEMO_MODE=true and Supabase (service role).
 * Never enabled in production without demo flag.
 */
export function isClientPortalDemoAuthEnabled(): boolean {
  return isDemoMode() && isSupabaseConfigured();
}

export async function demoRegisterConfirmedClientUser(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!isClientPortalDemoAuthEnabled()) {
    return { ok: false, code: "DEMO_AUTH_DISABLED" };
  }

  const email = normalizeInviteEmail(input.email);
  if (!email) return { ok: false, code: "INVALID_CREDENTIALS" };
  if (input.password.length < MIN_PASSWORD_LEN) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  const admin = getSupabaseAdmin();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
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
    return { ok: false, code: "REGISTRATION_FAILED" };
  }

  const { data: listed, error: listError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    return { ok: false, code: "REGISTRATION_FAILED" };
  }

  const existing = listed.users.find(
    (u) => u.email?.trim().toLowerCase() === email,
  );
  if (!existing?.id) {
    return { ok: false, code: "REGISTRATION_FAILED" };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    existing.id,
    {
      email_confirm: true,
      password: input.password,
    },
  );

  if (updateError) {
    return { ok: false, code: "REGISTRATION_FAILED" };
  }

  return { ok: true };
}
