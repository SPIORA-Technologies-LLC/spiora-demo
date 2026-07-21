import "server-only";

import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  sbGetClientPortalUserByAuthUserId,
} from "@/lib/supabase/client-portal-users-repo";
import {
  getLocalClientPortalUserByAuthUserId,
} from "@/lib/client-portal/local-store";
import type { ClientSession } from "./types";
import { isClientPortalLocale } from "./types";

function mapSession(row: {
  id: string;
  authUserId: string;
  email: string;
  preferredLocale: string;
  invitationId: string;
}): ClientSession | null {
  if (!isClientPortalLocale(row.preferredLocale)) return null;
  return {
    id: row.id,
    authUserId: row.authUserId,
    email: row.email,
    preferredLocale: row.preferredLocale,
    invitationId: row.invitationId,
  };
}

/**
 * Server-side client portal session.
 * Requires Supabase Auth user + client_portal_users row.
 * Never elevates to employee SessionUser.
 */
export async function getClientSession(): Promise<ClientSession | null> {
  try {
    const auth = await createSupabaseServerAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user?.id || !user.email) return null;

    if (isSupabaseConfigured()) {
      const row = await sbGetClientPortalUserByAuthUserId(user.id);
      if (!row) return null;
      return mapSession(row);
    }

    const local = await getLocalClientPortalUserByAuthUserId(user.id);
    if (!local) return null;
    return mapSession(local);
  } catch {
    return null;
  }
}

/** Auth user id for invite accept (may not yet have portal row). */
export async function getClientAuthUser(): Promise<{
  id: string;
  email: string;
} | null> {
  try {
    const auth = await createSupabaseServerAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user?.id || !user.email) return null;
    return { id: user.id, email: user.email.trim().toLowerCase() };
  } catch {
    return null;
  }
}

export async function destroyClientAuthSession(): Promise<void> {
  try {
    const auth = await createSupabaseServerAuthClient();
    await auth.auth.signOut();
  } catch {
    // ignore
  }
}
