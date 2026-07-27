import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { findTeamUserByEmail } from "@/lib/team/store";

/**
 * Presence / daily activity must use the Team roster id (e.g. olivia-bennett),
 * not Supabase Auth profile UUID. Heartbeat writes and Team page reads share
 * this key so online hours match the hard-coded demo roster.
 */
export async function resolvePresenceUserId(
  session: SessionUser,
): Promise<string> {
  const roster = await findTeamUserByEmail(session.email);
  return roster?.id ?? session.id;
}
